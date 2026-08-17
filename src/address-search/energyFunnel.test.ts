import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	energyFunnelUrl,
	energyWaitlistUrl,
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
