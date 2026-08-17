import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { resolveEnergyDestination } from "@/address-search/energyDestination";
import { fetchEnergyOnlyUtilities } from "@/address-search/fetch";

// Kept in step with DASHBOARD_WEB_HOST in scripts/run-address-validation-tests.mjs.
const HOST = "https://dashboard.test";

type Call = { url: string; body: unknown };
type CaptureCall = { event: string; properties?: Record<string, unknown> };

const captured: CaptureCall[] = [];
(globalThis as { window?: unknown }).window = {
	posthog: {
		capture: (event: string, properties?: Record<string, unknown>) => {
			captured.push({ event, properties });
		},
	},
};

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

	// The waitlist page sets `analytics: "none"` and reads no query params, so this
	// event is the only record that the zip was entered and found unserved.
	test("the waitlist emits zip_search_energy_waitlist with the zip and arm", async () => {
		stubFetch(utilitiesReply());
		await resolveEnergyDestination({ arm: "t2", zip: "99999" });
		assert.deepEqual(captured, [
			{
				event: "zip_search_energy_waitlist",
				properties: { zip: "99999", arm: "t2" },
			},
		]);
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
			assert.deepEqual(captured, []);
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
		assert.deepEqual(captured, []);
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
