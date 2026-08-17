import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { decorateRedirectUrl } from "@/address-search/decorateRedirectUrl";
import { resolveEnergyDestination } from "@/address-search/energyDestination";
import { fetchEnergyOnlyUtilities } from "@/address-search/fetch";

// Kept in step with DASHBOARD_WEB_HOST in scripts/run-address-validation-tests.mjs.
const HOST = "https://dashboard.test";

type Call = { url: string; body: unknown };
type CaptureCall = { event: string; properties?: Record<string, unknown> };

const captured: CaptureCall[] = [];
const stubWindow = {
	location: { origin: "https://www.basepowercompany.com", search: "" },
	posthog: {
		capture: (event: string, properties?: Record<string, unknown>) => {
			captured.push({ event, properties });
		},
		get_distinct_id: () => undefined as string | undefined,
	},
};
(globalThis as { window?: unknown }).window = stubWindow;
(globalThis as { document?: unknown }).document = { cookie: "" };

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	captured.length = 0;
});

/** Stub `fetch` with a fixed reply, recording what the client sent. */
function stubFetch(reply: {
	ok?: boolean;
	status?: number;
	json?: () => Promise<unknown>;
	throws?: Error;
}): Call[] {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({
			url: String(url),
			body: init?.body ? JSON.parse(String(init.body)) : undefined,
		});
		if (reply.throws) throw reply.throws;
		return {
			ok: reply.ok ?? true,
			status: reply.status ?? 200,
			json: reply.json ?? (async () => ({ data: { utilities: [] } })),
		};
	}) as never;
	return calls;
}

const DISPLAY_NAMES: Record<string, string> = {
	ONCOR: "Oncor",
	CENTERPOINT: "CenterPoint Energy",
	TNMP: "Texas-New Mexico Power",
};

// Mirrors what /api/energy-only-utility returns (base-monorepo #36903): the BFF
// maps growth's `utility`/`displayName` onto the `{ name, value }` option shape.
// Every `name` here differs from its `value`, so a client reading the display
// label instead of the internal code cannot pass.
const utilitiesReply = (...codes: string[]) => ({
	json: async () => ({
		success: true,
		data: {
			utilities: codes.map((code) => ({
				name: DISPLAY_NAMES[code] ?? `${code} label`,
				value: code,
			})),
		},
	}),
});

describe("resolveEnergyDestination", () => {
	// The whole point of the lookup: a zip the backend can name one TDSP for sends
	// that code on, so the reveal screen shows that utility's rate. The code
	// (`value`), never the display label (`name`) — the funnel matches on the code.
	test("a single utility rides along on the funnel URL", async () => {
		const calls = stubFetch(utilitiesReply("ONCOR"));
		const url = new URL(
			await resolveEnergyDestination({ arm: "t1", zip: "75001" }),
		);
		assert.equal(url.searchParams.get("utility"), "ONCOR");
		assert.equal(url.searchParams.get("postal_code"), "75001");
		assert.equal(calls.length, 1);
	});

	// Half of a cross-repo contract: handleEnergyOnlyUtility trims `zip_code` and
	// rejects anything but five digits. A drift on either side degrades silently to
	// "no utility" for every visitor rather than failing loudly, so pin it here.
	test("the lookup posts { zip_code } to /api/energy-only-utility", async () => {
		const calls = stubFetch(utilitiesReply("ONCOR"));
		await resolveEnergyDestination({ arm: "t1", zip: "75001" });
		assert.equal(calls[0].url, `${HOST}/api/energy-only-utility`);
		assert.deepEqual(calls[0].body, { zip_code: "75001" });
	});

	// Zero utilities is the one unambiguous "we do not serve this zip", so the
	// visitor goes to the waitlist instead of into a funnel that would quote a rate
	// for a market Base cannot serve.
	test("zero utilities routes to the waitlist, not the funnel", async () => {
		stubFetch(utilitiesReply());
		const url = new URL(
			await resolveEnergyDestination({ arm: "t1", zip: "99999" }),
		);
		assert.equal(url.origin, "https://www.basepowercompany.com");
		assert.equal(url.pathname, "/energy-soon");
		assert.equal(url.searchParams.get("postal_code"), "99999");
		assert.equal(
			url.searchParams.get("experiment_flag"),
			"eo_zip_entry_0813:t1",
		);
		assert.equal(url.searchParams.has("utility"), false);
	});

	// Closes the submit-vs-result gap that "Zip entry activity (daily)" reads as a
	// lookup failure. utilityCount is also the only count of how often a zip
	// straddles a TDSP boundary — the data the multi-utility decision needs.
	test("a resolved lookup reports its count and first utility", async () => {
		for (const [codes, count, first] of [
			[["ONCOR"], 1, "ONCOR"],
			[[], 0, undefined],
			[["ONCOR", "TNMP"], 2, "ONCOR"],
		] as const) {
			captured.length = 0;
			stubFetch(utilitiesReply(...codes));
			await resolveEnergyDestination({ arm: "t1", zip: "75001" });
			const result = captured.find(
				(c) => c.event === "zip_search_energy_result",
			);
			assert.deepEqual(result?.properties, {
				zip: "75001",
				arm: "t1",
				utilityCount: count,
				utility: first,
			});
		}
	});

	// A lookup that broke reported nothing, so it must not claim a result. The
	// remaining gap is exactly what tells a broken endpoint from a served market.
	test("a failed lookup reports no result event", async () => {
		for (const reply of [
			{ throws: new Error("network down") },
			{ ok: false, status: 500 },
			{ json: async () => ({ success: true, data: {} }) },
		]) {
			captured.length = 0;
			stubFetch(reply);
			await resolveEnergyDestination({ arm: "t1", zip: "75001" });
			assert.deepEqual(
				captured.map((c) => c.event),
				[],
			);
		}
	});

	// The waitlist page sets `analytics: "none"` and reads no query params, so this
	// event is the only record that the zip was entered and found unserved.
	test("the waitlist emits zip_search_energy_waitlist with the zip and arm", async () => {
		stubFetch(utilitiesReply());
		await resolveEnergyDestination({ arm: "t2", zip: "99999" });
		assert.deepEqual(
			captured.filter((c) => c.event === "zip_search_energy_waitlist"),
			[
				{
					event: "zip_search_energy_waitlist",
					properties: { zip: "99999", arm: "t2" },
				},
			],
		);
	});

	// The distinction that matters: a lookup that broke says nothing about the
	// market. Waitlisting on a timeout would tell a serviceable visitor we do not
	// serve them, and it is silent — they never see an error.
	test("a failed lookup goes to the funnel, never the waitlist", async () => {
		for (const reply of [
			{ throws: new Error("network down") },
			{ ok: false, status: 500 },
			{ json: async () => ({ success: true, data: {} }) },
		]) {
			captured.length = 0;
			stubFetch(reply);
			const url = new URL(
				await resolveEnergyDestination({ arm: "t1", zip: "75001" }),
			);
			assert.equal(url.pathname, "/join-energy-plan");
			assert.deepEqual(
				captured.filter((c) => c.event === "zip_search_energy_waitlist"),
				[],
			);
		}
	});

	// A straddling zip IS served — it just cannot be pinned to one TDSP from a zip
	// alone. Waitlisting it would turn ~6.6% of a live market away.
	test("a multi-utility zip goes to the funnel, never the waitlist", async () => {
		stubFetch(utilitiesReply("ONCOR", "TNMP"));
		const url = new URL(
			await resolveEnergyDestination({ arm: "t1", zip: "78681" }),
		);
		assert.equal(url.pathname, "/join-energy-plan");
		assert.deepEqual(
			captured.filter((c) => c.event === "zip_search_energy_waitlist"),
			[],
		);
	});

	// ~90 of 1,358 zips straddle a TDSP boundary. Picking the first would show ~6.6%
	// of visitors a rate for a utility that may not serve them.
	test("a multi-utility zip sends no utility rather than a guess", async () => {
		stubFetch(utilitiesReply("ONCOR", "TNMP"));
		const url = new URL(
			await resolveEnergyDestination({ arm: "t2", zip: "78681" }),
		);
		assert.equal(url.searchParams.has("utility"), false);
		assert.equal(url.searchParams.get("postal_code"), "78681");
	});

	// A lookup failure must not block the visitor: the funnel renders a
	// utility-agnostic rate and records reason: "unknown_utility".
	// The non-2xx body deliberately carries a utility: against an empty body the
	// assertion could not tell "honours the status" from "found nothing anyway".
	for (const [name, reply] of [
		["a rejected fetch", { throws: new Error("network down") }],
		["a non-2xx", { ok: false, status: 500, ...utilitiesReply("ONCOR") }],
		[
			"an unparseable body",
			{
				json: async () => {
					throw new SyntaxError("Unexpected token <");
				},
			},
		],
	] as const) {
		test(`${name} degrades to no utility, not an error`, async () => {
			stubFetch(reply);
			const url = new URL(
				await resolveEnergyDestination({ arm: "t1", zip: "75001" }),
			);
			assert.equal(url.searchParams.has("utility"), false);
			assert.equal(url.searchParams.get("postal_code"), "75001");
			assert.equal(
				url.searchParams.get("experiment_flag"),
				"eo_zip_entry_0813:t1",
			);
		});
	}

	// Both cases send no utility, so the destination cannot tell them apart — but
	// "outside the footprint" and "the lookup broke" are different product facts,
	// and which one a zip hit decides what the zero-utility case should do.
	test("a zero-utility zip is a successful lookup, a wrong shape is not", async () => {
		stubFetch(utilitiesReply());
		assert.deepEqual(await fetchEnergyOnlyUtilities("99999"), {
			success: true,
			utilities: [],
		});

		// The realistic drift now that the route exists: `data.utilities` renamed or
		// dropped on the BFF side. A 400/500 never reaches here — `res.ok` catches it.
		stubFetch({ json: async () => ({ success: true, data: {} }) });
		const broken = await fetchEnergyOnlyUtilities("75001");
		assert.equal(broken.success, false);
		// Diagnosed as a shape problem, not surfaced as an incidental TypeError from
		// mapping over nothing. The route is new, so the first bad deploy is likely
		// to be a shape mismatch and the error text is what names it.
		assert.match(broken.success ? "" : broken.error, /shape/);
	});

	// Both arms must be measurable, not just the one that happens to be tested.
	test("both arms carry postal_code and their own experiment_flag", async () => {
		for (const [arm, pathname] of [
			["t1", "/join-energy-plan"],
			["t2", "/join-energy-calculator"],
		] as const) {
			stubFetch(utilitiesReply("CENTERPOINT"));
			const url = new URL(
				await resolveEnergyDestination({ arm, zip: "77002" }),
			);
			assert.equal(url.pathname, pathname);
			assert.equal(url.searchParams.get("postal_code"), "77002");
			assert.equal(url.searchParams.get("utility"), "CENTERPOINT");
			assert.equal(
				url.searchParams.get("experiment_flag"),
				`eo_zip_entry_0813:${arm}`,
			);
		}
	});
});

/**
 * The question this answers: does the energy zip redirect carry the same
 * attribution as address mode? Both go through the one `decorateRedirectUrl`, so
 * parity is structural — but nothing proved it, and `decorateRedirectUrl` has no
 * direct test of its own. These pin it for the energy path specifically.
 */
describe("energy zip attribution parity with address mode", () => {
	// Every source decorateRedirectUrl reads: cookies, the localStorage `urchin`
	// blob, and the current URL — plus base_vid and the PostHog distinct id.
	function seedAttribution() {
		(globalThis as { document?: unknown }).document = {
			cookie:
				"utm_source=google; gclid=gclid-1; promo_code=SAVE10; base_vid=vid-cookie; ttclid=tt-1",
		};
		(globalThis as { localStorage?: unknown }).localStorage = {
			getItem: (key: string) =>
				key === "urchin"
					? JSON.stringify({ utm_medium: "cpc", referrer_name: "partner" })
					: null,
		};
		stubWindow.location.search = "?utm_campaign=summer&utm_term=battery";
		stubWindow.posthog.get_distinct_id = () => "person-xyz";
	}

	function clearAttribution() {
		(globalThis as { document?: unknown }).document = { cookie: "" };
		(globalThis as { localStorage?: unknown }).localStorage = undefined;
		stubWindow.location.search = "";
		stubWindow.posthog.get_distinct_id = () => undefined;
	}

	afterEach(clearAttribution);

	// What ZipSearchApp actually does with the resolved destination.
	async function decoratedEnergyUrl(zip: string, utilities: string[]) {
		stubFetch(utilitiesReply(...utilities));
		return new URL(
			decorateRedirectUrl(await resolveEnergyDestination({ arm: "t1", zip })),
		);
	}

	// Every key from all three sources must survive, or a paid click that converts
	// through the zip arm is attributed to nothing.
	test("the funnel redirect carries every attribution param", async () => {
		seedAttribution();
		const url = await decoratedEnergyUrl("75001", ["ONCOR"]);
		assert.deepEqual(Object.fromEntries(url.searchParams), {
			// the energy path's own params
			postal_code: "75001",
			utility: "ONCOR",
			experiment_flag: "eo_zip_entry_0813:t1",
			// cookies
			utm_source: "google",
			gclid: "gclid-1",
			promo_code: "SAVE10",
			ttclid: "tt-1",
			// localStorage `urchin`
			utm_medium: "cpc",
			referrer_name: "partner",
			// the current URL
			utm_campaign: "summer",
			utm_term: "battery",
			// identity
			base_vid: "vid-cookie",
			person_id: "person-xyz",
		});
	});

	// The waitlist is a redirect like any other. Losing attribution here would
	// undercount exactly the visitors whose market Base wants to prioritise.
	test("the waitlist redirect carries the same attribution", async () => {
		seedAttribution();
		const url = await decoratedEnergyUrl("99999", []);
		assert.equal(url.pathname, "/energy-soon");
		for (const [key, value] of [
			["utm_source", "google"],
			["utm_medium", "cpc"],
			["utm_campaign", "summer"],
			["gclid", "gclid-1"],
			["promo_code", "SAVE10"],
			["base_vid", "vid-cookie"],
			["person_id", "person-xyz"],
		] as const) {
			assert.equal(url.searchParams.get(key), value, `waitlist lost ${key}`);
		}
	});

	// Same decorator, same environment, same result — with one documented
	// exception: address mode also sets external_id, which zip entry has no
	// address to produce.
	test("address mode adds external_id and nothing else the zip path lacks", async () => {
		seedAttribution();
		const energy = await decoratedEnergyUrl("75001", ["ONCOR"]);
		const address = new URL(
			decorateRedirectUrl(
				"https://join.basepowercompany.com/join-now?postal_code=75001&utility=ONCOR",
				"ext-addr-1",
			),
		);

		const attribution = (url: URL) => {
			const keys = [...url.searchParams.keys()].filter(
				(k) => !["postal_code", "utility", "experiment_flag"].includes(k),
			);
			return Object.fromEntries(
				keys.sort().map((k) => [k, url.searchParams.get(k)]),
			);
		};

		const energyKeys = attribution(energy);
		const addressKeys = attribution(address);
		assert.equal(addressKeys.external_id, "ext-addr-1");
		assert.equal(energyKeys.external_id, undefined);
		delete addressKeys.external_id;
		assert.deepEqual(energyKeys, addressKeys);
	});
});
