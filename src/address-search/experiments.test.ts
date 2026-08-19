import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";
import {
	captureExposure,
	ctaForComedArm,
	ctaForEnergyArm,
	posthogOnFeatureFlags,
	resolvePlanRevealArm,
	resolveZipEntryComedArm,
	resolveZipEntryEnergyArm,
} from "@/address-search/experiments";

type CaptureOptions = { send_instantly?: boolean; transport?: string };

type CaptureCall = {
	event: string;
	properties?: Record<string, unknown>;
	options?: CaptureOptions;
};

type StubWindow = {
	posthog?: {
		onFeatureFlags?: (callback: () => void) => void;
		getFeatureFlag?: (
			key: string,
			options?: { send_event?: boolean },
		) => string | boolean | undefined;
		capture?: (
			event: string,
			properties?: Record<string, unknown>,
			options?: CaptureOptions,
		) => void;
	};
};

const stub: StubWindow = {};
(globalThis as { window?: unknown }).window = stub;

describe("posthogOnFeatureFlags", () => {
	beforeEach(() => {
		stub.posthog = undefined;
	});

	test("subscribes and reports true when PostHog is present", () => {
		let subscribed: (() => void) | undefined;
		stub.posthog = {
			onFeatureFlags: (callback) => {
				subscribed = callback;
			},
		};
		let fired = false;
		assert.equal(
			posthogOnFeatureFlags(() => {
				fired = true;
			}),
			true,
		);
		subscribed?.();
		assert.equal(fired, true);
	});

	test("reports false when PostHog is absent", () => {
		assert.equal(
			posthogOnFeatureFlags(() => {}),
			false,
		);
	});
});

describe("resolvePlanRevealArm", () => {
	let captures: CaptureCall[] = [];

	const stubFlag = (variant: string | boolean | undefined) => {
		captures = [];
		stub.posthog = {
			getFeatureFlag: () => variant,
			capture: (event, properties, options) => {
				captures.push({ event, properties, options });
			},
		};
	};

	beforeEach(() => {
		captures = [];
		stub.posthog = undefined;
	});

	// Routed through captureExposure, so it inherits the unload-safe options.
	test("records the exposure for an assigned visitor", () => {
		stubFlag("test");
		assert.equal(resolvePlanRevealArm(), "test");
		assert.equal(captures.length, 1);
		assert.equal(captures[0].event, "$feature_flag_called");
		assert.equal(
			captures[0].properties?.$feature_flag,
			"dereg_plan_reveal_0724",
		);
		assert.equal(captures[0].properties?.$feature_flag_response, "test");
		assert.equal(captures[0].options?.transport, "sendBeacon");
		assert.equal(captures[0].options?.send_instantly, true);
	});

	// Reading with the built-in exposure on would log every visitor, not just assigned ones.
	test("reads the flag without posthog's built-in exposure", () => {
		let seen: { send_event?: boolean } | undefined;
		stub.posthog = {
			getFeatureFlag: (_key, options) => {
				seen = options;
				return "control";
			},
			capture: () => {},
		};
		resolvePlanRevealArm();
		assert.equal(seen?.send_event, false);
	});

	// Exposure must stay scoped to assigned users, or the experiment denominator inflates.
	test("logs no exposure for a user outside the rollout", () => {
		stubFlag(false);
		assert.equal(resolvePlanRevealArm(), "unassigned");
		assert.equal(captures.length, 0);
	});
});

describe("resolveZipEntryComedArm", () => {
	let captures: CaptureCall[] = [];

	const stubFlag = (variant: string | boolean | undefined) => {
		captures = [];
		stub.posthog = {
			getFeatureFlag: () => variant,
			capture: (event, properties, options) => {
				captures.push({ event, properties, options });
			},
		};
	};

	beforeEach(() => {
		captures = [];
		stub.posthog = undefined;
	});

	// Routed through captureExposure, so it inherits the unload-safe options.
	test("records the exposure for an assigned visitor", () => {
		stubFlag("test");
		assert.equal(resolveZipEntryComedArm(), "test");
		assert.equal(captures.length, 1);
		assert.equal(captures[0].event, "$feature_flag_called");
		assert.equal(captures[0].properties?.$feature_flag, "zip_entry_comed_0803");
		assert.equal(captures[0].properties?.$feature_flag_response, "test");
		assert.equal(captures[0].options?.transport, "sendBeacon");
		assert.equal(captures[0].options?.send_instantly, true);
	});

	// Reading with the built-in exposure on would log every visitor, not just assigned ones.
	test("reads the flag without posthog's built-in exposure", () => {
		let seen: { send_event?: boolean } | undefined;
		stub.posthog = {
			getFeatureFlag: (_key, options) => {
				seen = options;
				return "control";
			},
			capture: () => {},
		};
		resolveZipEntryComedArm();
		assert.equal(seen?.send_event, false);
	});

	// Exposure must stay scoped to assigned users, or the experiment denominator inflates.
	test("logs no exposure for a user outside the rollout", () => {
		stubFlag(false);
		assert.equal(resolveZipEntryComedArm(), "unassigned");
		assert.equal(captures.length, 0);
	});
});

describe("resolveZipEntryEnergyArm", () => {
	let captures: CaptureCall[] = [];

	const stubFlag = (variant: string | boolean | undefined) => {
		captures = [];
		stub.posthog = {
			getFeatureFlag: () => variant,
			capture: (event, properties, options) => {
				captures.push({ event, properties, options });
			},
		};
	};

	beforeEach(() => {
		captures = [];
		stub.posthog = undefined;
	});

	// Both treatment arms are real assignments, so both must log an exposure —
	// a three-arm experiment that only counted one would skew its own split.
	for (const arm of ["t1", "t2", "control"] as const) {
		test(`records the exposure for an assigned ${arm} visitor`, () => {
			stubFlag(arm);
			assert.equal(resolveZipEntryEnergyArm(), arm);
			assert.equal(captures.length, 1);
			assert.equal(captures[0].event, "$feature_flag_called");
			assert.equal(captures[0].properties?.$feature_flag, "eo_zip_entry_0813");
			assert.equal(captures[0].properties?.$feature_flag_response, arm);
			assert.equal(captures[0].options?.transport, "sendBeacon");
			assert.equal(captures[0].options?.send_instantly, true);
		});
	}

	// Reading with the built-in exposure on would log every visitor, not just assigned ones.
	test("reads the flag without posthog's built-in exposure", () => {
		let seen: { send_event?: boolean } | undefined;
		stub.posthog = {
			getFeatureFlag: (_key, options) => {
				seen = options;
				return "control";
			},
			capture: () => {},
		};
		resolveZipEntryEnergyArm();
		assert.equal(seen?.send_event, false);
	});

	// Exposure must stay scoped to assigned users, or the experiment denominator inflates.
	test("logs no exposure for a user outside the rollout", () => {
		stubFlag(false);
		assert.equal(resolveZipEntryEnergyArm(), "unassigned");
		assert.equal(captures.length, 0);
	});

	// The ComEd flag's variant is "test"; reading it here would silently render zip
	// entry for a visitor this experiment never assigned.
	test("an unrecognized variant is unassigned, not a treatment arm", () => {
		stubFlag("test");
		assert.equal(resolveZipEntryEnergyArm(), "unassigned");
		assert.equal(captures.length, 0);
	});
});

describe("ctaForEnergyArm", () => {
	// Each arm names its own reveal, so neither may inherit the host's address copy.
	// t2's label matches /energy's own hero CTA (EnergyPage.tsx heroCtaLabel), which
	// is what control renders — so between t2 and control only the entry changes.
	test("t1 offers the plans and t2 the savings", () => {
		assert.equal(
			ctaForEnergyArm("t1", "Get savings estimate"),
			"See available plans",
		);
		assert.equal(
			ctaForEnergyArm("t2", "Get savings estimate"),
			"See how much you can save",
		);
	});

	// The two arms must not share a label, or CTA copy stops distinguishing them.
	test("the two treatment arms differ", () => {
		assert.notEqual(
			ctaForEnergyArm("t1", undefined),
			ctaForEnergyArm("t2", undefined),
		);
	});

	// Zip arms own their copy outright: a host cta must not reach them.
	test("a host cta cannot override a treatment arm", () => {
		assert.equal(
			ctaForEnergyArm("t1", "Check availability"),
			"See available plans",
		);
	});

	// Control renders the address entry, which is the untouched /energy embed.
	test("control and unassigned keep the host cta verbatim", () => {
		assert.equal(
			ctaForEnergyArm("control", "Get savings estimate"),
			"Get savings estimate",
		);
		assert.equal(
			ctaForEnergyArm("unassigned", "Get savings estimate"),
			"Get savings estimate",
		);
		assert.equal(ctaForEnergyArm("control", undefined), undefined);
	});
});

describe("ctaForComedArm", () => {
	// zip_entry_comed_0803 ended 2026-08-12 pinned to `test`, so there is no second
	// arm left to hold the copy steady against — the host owns the label again.
	test("the zip arm honors the host cta", () => {
		assert.equal(
			ctaForComedArm("zip", true, "See if your home qualifies"),
			"See if your home qualifies",
		);
	});

	test("the address arm keeps the host cta", () => {
		assert.equal(
			ctaForComedArm("address", true, "See if your home qualifies"),
			"See if your home qualifies",
		);
	});

	// The address entry has no CTA default of its own, so without this fallback an
	// embed omitting `cta` renders an address arm with no button at all.
	test("neither arm is button-less when the embed omits cta", () => {
		assert.equal(ctaForComedArm("zip", true, undefined), undefined);
		assert.ok(
			ctaForComedArm("address", true, undefined),
			"the address arm must fall back to a label of its own",
		);
	});

	// mode="zip" is rolled out, not an arm: it must keep honoring its own label.
	test("a rolled-out zip embed still honors its own cta", () => {
		assert.equal(ctaForComedArm("zip", false, "Check my zip"), "Check my zip");
	});

	// Regression guard for every non-experiment embed on the marketing site: an
	// address embed without `cta` must stay button-less exactly as before.
	test("a plain address embed is unchanged, absent cta included", () => {
		assert.equal(ctaForComedArm("address", false, undefined), undefined);
		assert.equal(
			ctaForComedArm("address", false, "See if your home qualifies"),
			"See if your home qualifies",
		);
	});
});

describe("captureExposure", () => {
	beforeEach(() => {
		stub.posthog = undefined;
	});

	// An arm that navigates fires this microseconds before unload; batching loses it,
	// and because only the diverting arm navigates the loss is one-sided (SRM, not just volume).
	test("skips the batch queue and uses the unload-safe transport", () => {
		const captures: CaptureCall[] = [];
		stub.posthog = {
			capture: (event, properties, options) => {
				captures.push({ event, properties, options });
			},
		};

		captureExposure("some_flag_0101", "variant-b");

		assert.deepEqual(captures, [
			{
				event: "$feature_flag_called",
				properties: {
					$feature_flag: "some_flag_0101",
					$feature_flag_response: "variant-b",
				},
				options: { send_instantly: true, transport: "sendBeacon" },
			},
		]);
	});

	test("is inert when PostHog is absent", () => {
		assert.doesNotThrow(() => captureExposure("some_flag_0101", "control"));
	});
});

// Guard, not a behavior test: a future experiment that hand-rolls the capture would
// silently reintroduce the batched-queue loss, so keep emission in one place.
describe("exposure capture stays centralized", () => {
	const EXPOSURE_EVENT = "$feature_flag_called";
	const OWNER = path.join("address-search", "experiments.ts");

	const sourceFiles = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) return sourceFiles(full);
			return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")
				? [full]
				: [];
		});

	test(`only ${OWNER} emits ${EXPOSURE_EVENT}`, () => {
		const srcDir = path.join(process.cwd(), "src");
		const files = sourceFiles(srcDir);
		// Fail loud rather than vacuously pass if the layout moves.
		assert.ok(files.length > 0, `no source files found under ${srcDir}`);

		// Quoted literal only — prose mentioning the event name isn't an emission.
		const emitted = /["'`]\$feature_flag_called["'`]/;
		const emitters = files
			.filter((file) => emitted.test(readFileSync(file, "utf8")))
			.map((file) => path.relative(srcDir, file));

		assert.deepEqual(
			emitters,
			[OWNER],
			`${EXPOSURE_EVENT} must be emitted only via captureExposure() in ${OWNER}`,
		);
	});

	// The other half of "one exposure per visitor": these resolvers fire the
	// exposure as a side effect, and element.tsx's flag gate memoizes exactly one
	// call per element. A second call site anywhere is a second exposure for the
	// same person, which skews the split the SRM check reads. Consumers that need
	// the arm — the control arm's `experiment_flag` stamp included — must thread
	// the value the gate already resolved.
	for (const resolver of [
		"resolveZipEntryEnergyArm",
		"resolveZipEntryComedArm",
	] as const) {
		test(`nothing calls ${resolver}() outside its flag gate`, () => {
			const srcDir = path.join(process.cwd(), "src");
			const files = sourceFiles(srcDir);
			assert.ok(files.length > 0, `no source files found under ${srcDir}`);

			// The gate is handed the function, never a call, so any invocation is a
			// second exposure. The declaration in experiments.ts is not one.
			const called = new RegExp(`(?<!function )${resolver}\\(`);
			const callers = files
				.filter((file) => called.test(readFileSync(file, "utf8")))
				.map((file) => path.relative(srcDir, file));

			assert.deepEqual(
				callers,
				[],
				`${resolver}() must be called only by the flag gate, via its resolveArm reference`,
			);
		});
	}
});
