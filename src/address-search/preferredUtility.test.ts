import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { autoSelectPreferredUtility } from "@/address-search/preferredUtility";
import type { ZipRedirectStrategy } from "@/address-search/types";

type Capture = { event: string; properties: Record<string, unknown> };
const captures: Capture[] = [];

(globalThis as { window?: unknown }).window = {
	location: { origin: "https://www.basepowercompany.com", search: "" },
	posthog: {
		capture: (event: string, properties: Record<string, unknown>) =>
			captures.push({ event, properties }),
	},
};
(globalThis as { document?: unknown }).document = { cookie: "" };

// Shape confirmed against production zip_search_multiple_utility_result events.
const COSERV = {
	name: "CoServ",
	value: "COSERV",
	redirectUrl: "/coserv/join?postal_code=75009&utility=COSERV",
};
const ONCOR = {
	name: "Oncor",
	value: "ONCOR",
	redirectUrl:
		"https://join.basepowercompany.com/join-now?postal_code=75009&utility=ONCOR",
};

const multiple: ZipRedirectStrategy = {
	redirectUrl: COSERV.redirectUrl,
	isMultiple: true,
	multiple: { options: [COSERV, ONCOR] },
};

const single: ZipRedirectStrategy = {
	redirectUrl: COSERV.redirectUrl,
	isMultiple: false,
	utility: "COSERV",
};

function run(strategy: ZipRedirectStrategy, preferred: string | undefined) {
	captures.length = 0;
	const emitted: { redirectUrl: string; utility?: string }[] = [];
	const handled = autoSelectPreferredUtility({
		strategy,
		preferred,
		zip: "75009",
		emitRedirect: (redirectUrl, utility) =>
			emitted.push({ redirectUrl, utility }),
	});
	return { handled, emitted, captures: [...captures] };
}

describe("autoSelectPreferredUtility", () => {
	test("takes the matching option and emits its raw redirect URL", () => {
		const { handled, emitted } = run(multiple, "COSERV");
		assert.equal(handled, true);
		// Raw, not pre-transformed: the caller's emitRedirect owns the
		// decoration, and transforming here would double-apply it.
		assert.deepEqual(emitted, [
			{ redirectUrl: COSERV.redirectUrl, utility: "COSERV" },
		]);
	});

	test("captures the auto-select with the zip, chosen utility and options", () => {
		const { captures } = run(multiple, "COSERV");
		assert.deepEqual(captures, [
			{
				event: "zip_search_preferred_utility_auto_selected",
				properties: {
					zip: "75009",
					utility: "COSERV",
					utilityOptions: [COSERV, ONCOR],
				},
			},
		]);
	});

	// The default has to be exactly today's behaviour: a page that does not opt in
	// still disambiguates in the picker.
	test("no preferred utility leaves the picker to handle the result", () => {
		for (const preferred of [undefined, ""]) {
			const { handled, emitted, captures } = run(multiple, preferred);
			assert.equal(handled, false);
			assert.deepEqual(emitted, []);
			assert.deepEqual(captures, []);
		}
	});

	// A preference is not a claim about which utilities a zip serves; anything
	// unmatched must still be disambiguated by the user.
	test("a preference that matches no option leaves the picker", () => {
		const { handled, emitted, captures } = run(multiple, "CENTERPOINT");
		assert.equal(handled, false);
		assert.deepEqual(emitted, []);
		assert.deepEqual(captures, []);
	});

	// A single-utility zip already has its route, and its own path decorates
	// the redirect — auto-selecting here would skip that.
	test("a single-utility result is untouched, even when its utility matches", () => {
		const { handled, emitted, captures } = run(single, "COSERV");
		assert.equal(handled, false);
		assert.deepEqual(emitted, []);
		assert.deepEqual(captures, []);
	});

	// Exact match on `value`: the display name and casing variants are not the key.
	test("matches on value exactly, not on name or case", () => {
		for (const preferred of ["CoServ", "coserv", "Oncor "]) {
			assert.equal(run(multiple, preferred).handled, false);
		}
	});
});
