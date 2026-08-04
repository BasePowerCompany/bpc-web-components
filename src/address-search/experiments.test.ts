import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";
import {
	captureExposure,
	posthogOnFeatureFlags,
	resolvePlanRevealArm,
	resolveZipEntryComedArm,
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
});
