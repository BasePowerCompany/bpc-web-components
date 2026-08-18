import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
	energyControlExperimentFlag,
	energyFunnelUrl,
	energyWaitlistUrl,
	stampExperimentFlag,
} from "@/address-search/energyFunnel";

describe("energyFunnelUrl", () => {
	// The arm→route mapping IS the experiment: swapping these silently gives both
	// arms the same destination and the test measures nothing.
	test("t1 reveals a plan and t2 a calculator", () => {
		assert.equal(
			energyFunnelUrl({ arm: "t1", zip: "75001" }),
			"https://join.basepowercompany.com/join-energy-plan?postal_code=75001&experiment_flag=eo_zip_entry_0813%3At1",
		);
		assert.equal(
			energyFunnelUrl({ arm: "t2", zip: "75001" }),
			"https://join.basepowercompany.com/join-energy-calculator?postal_code=75001&experiment_flag=eo_zip_entry_0813%3At2",
		);
	});

	// Inert until this embed emits it: nothing else records which arm a visitor was
	// in, because these flows write no lead. The colon-joined `<flagKey>:<variant>`
	// shape is what the funnel's hidden-param parser splits on.
	test("each arm stamps its own experiment_flag", () => {
		for (const arm of ["t1", "t2"] as const) {
			const url = new URL(energyFunnelUrl({ arm, zip: "75001" }));
			assert.equal(
				url.searchParams.get("experiment_flag"),
				`eo_zip_entry_0813:${arm}`,
			);
		}
	});

	// The reveal screen selects its rate from `utility`, so the name must be exact.
	test("a known utility rides along as `utility`", () => {
		const url = new URL(
			energyFunnelUrl({ arm: "t2", zip: "77002", utility: "CENTERPOINT" }),
		);
		assert.equal(url.searchParams.get("postal_code"), "77002");
		assert.equal(url.searchParams.get("utility"), "CENTERPOINT");
	});

	// ~90 of 1,358 zips straddle a TDSP boundary. The param is omitted rather than
	// sent empty, so the funnel takes its unknown_utility path instead of trying
	// to resolve a rate for "".
	test("an unresolved utility is omitted, not blank", () => {
		const url = new URL(energyFunnelUrl({ arm: "t1", zip: "75001" }));
		assert.equal(url.searchParams.has("utility"), false);
		assert.equal(
			new URL(
				energyFunnelUrl({ arm: "t1", zip: "75001", utility: "" }),
			).searchParams.has("utility"),
			false,
		);
	});

	// These arms render on www but the funnel lives on the join host, so a relative
	// path would land the visitor on a marketing 404.
	test("the destination is pinned to the funnel origin", () => {
		for (const arm of ["t1", "t2"] as const) {
			const url = new URL(energyFunnelUrl({ arm, zip: "75001" }));
			assert.equal(url.origin, "https://join.basepowercompany.com");
		}
	});

	// Guard against a future edit reaching for zipFunnel's /join-now-zip family:
	// that data has no AEP or TNMP rows and would waitlist most of this market.
	test("neither arm routes through a battery-footprint zip path", () => {
		for (const arm of ["t1", "t2"] as const) {
			const path = new URL(energyFunnelUrl({ arm, zip: "75001" })).pathname;
			assert.ok(
				path.startsWith("/join-energy-"),
				`${arm} must stay on an energy-only route, got ${path}`,
			);
		}
	});
});

describe("energyWaitlistUrl", () => {
	// The opposite pin from the funnel: /energy-soon is a marketing page on www, so
	// inheriting the join origin — the easy copy-paste error — would 404.
	test("the waitlist is pinned to www, not the funnel host", () => {
		for (const arm of ["t1", "t2"] as const) {
			const url = new URL(energyWaitlistUrl({ arm, zip: "99999" }));
			assert.equal(url.origin, "https://www.basepowercompany.com");
			assert.equal(url.pathname, "/energy-soon");
		}
	});

	// Both arms waitlist to the same page, so the stamp is the only thing that says
	// which arm the visitor was in when they were turned away.
	test("both arms carry the zip and their own experiment_flag", () => {
		for (const arm of ["t1", "t2"] as const) {
			const url = new URL(energyWaitlistUrl({ arm, zip: "99999" }));
			assert.equal(url.searchParams.get("postal_code"), "99999");
			assert.equal(
				url.searchParams.get("experiment_flag"),
				`eo_zip_entry_0813:${arm}`,
			);
		}
	});
});

// A redirect as the address path hands it over: absolute, already decorated.
const DECORATED =
	"https://join.basepowercompany.com/join-now?external_id=ext-1&base_vid=vid-1";

const stampedFor = (
	isZipEnergyMode: boolean,
	arm: Parameters<typeof energyControlExperimentFlag>[1],
) =>
	stampExperimentFlag(
		DECORATED,
		energyControlExperimentFlag(isZipEnergyMode, arm),
	);

describe("the control arm's stamp", () => {
	// Checkout turns `experiment_flag` into a HubSpot property the same way for
	// every arm, so an unstamped control conversion has no arm at all — a
	// one-sided gap that credits the treatments with every conversion.
	test("control's address redirect carries its arm", () => {
		const url = new URL(stampedFor(true, "control"));
		assert.equal(
			url.searchParams.get("experiment_flag"),
			"eo_zip_entry_0813:control",
		);
		// The attribution the funnel already reads must survive the stamp.
		assert.equal(url.searchParams.get("external_id"), "ext-1");
		assert.equal(url.searchParams.get("base_vid"), "vid-1");
	});

	// One parser in the funnel splits `<flagKey>:<variant>` for all three arms, so
	// control's tag has to be the same shape the treatments already emit.
	test("control's tag matches the shape the treatments emit", () => {
		assert.equal(
			new URL(energyFunnelUrl({ arm: "t1", zip: "75001" })).searchParams.get(
				"experiment_flag",
			),
			"eo_zip_entry_0813:t1",
		);
		assert.equal(
			energyControlExperimentFlag(true, "control"),
			"eo_zip_entry_0813:control",
		);
	});

	// No exposure fires for `unassigned` — flag off, PostHog absent, or the gate
	// timed out (2.2% of persons on the live ComEd gate). Tagging them would add
	// people to HubSpot's arm population that PostHog's denominator never counted.
	test("an unassigned visitor is never stamped", () => {
		assert.equal(energyControlExperimentFlag(true, "unassigned"), undefined);
		assert.equal(stampedFor(true, "unassigned"), DECORATED);
	});

	// Regression guard for every other surface this element ships on: mode="address",
	// "zip" and "zip-comed" must emit the URL they emit today, byte for byte.
	test("no other mode is stamped, whatever arm is in scope", () => {
		for (const arm of [
			"t1",
			"t2",
			"control",
			"unassigned",
			undefined,
		] as const) {
			assert.equal(energyControlExperimentFlag(false, arm), undefined);
			assert.equal(stampedFor(false, arm), DECORATED);
		}
	});

	// The treatment arms never take this path: energyFunnelUrl stamps their URLs as
	// it builds them, and stamping again here would be a second source of truth.
	test("the treatment arms are not stamped on the address path", () => {
		assert.equal(energyControlExperimentFlag(true, "t1"), undefined);
		assert.equal(energyControlExperimentFlag(true, "t2"), undefined);
		// Undefined is "the gate has not resolved" — nothing to attribute yet.
		assert.equal(energyControlExperimentFlag(true, undefined), undefined);
	});

	// This runs microseconds before a navigation, so a URL it cannot parse must
	// pass through, exactly as decorateRedirectUrl does with the same input.
	test("a URL it cannot parse passes through unchanged", () => {
		assert.equal(
			stampExperimentFlag("://not a url", "eo_zip_entry_0813:control"),
			"://not a url",
		);
	});
});

// Guard, not a behavior test: the arm has to ride out on every redirect the
// address path emits (single result, utility modal, energy splash). A new
// dispatch site that skipped the stamp would silently reopen the one-sided gap
// this stamp exists to close, and no unit test here would notice.
describe("every address redirect is stamped", () => {
	test("each onResultEvent dispatch has its own stampExperimentFlag call", () => {
		const source = readFileSync(
			path.join(process.cwd(), "src/address-search/AddressSearchApp.tsx"),
			"utf8",
		);
		const count = (pattern: RegExp) => source.match(pattern)?.length ?? 0;

		const dispatches = count(/onResultEvent\(\{/g);
		// Fail loud rather than vacuously pass if the component is restructured.
		assert.ok(dispatches > 0, "no redirect dispatch found in AddressSearchApp");
		assert.equal(
			count(/stampExperimentFlag\(/g),
			dispatches,
			"every dispatched redirect must be stamped before it is captured",
		);
	});
});
