import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
	posthogOnFeatureFlags,
	resolvePlanRevealArm,
} from "@/address-search/experiments";

type CaptureCall = {
	event: string;
	properties?: Record<string, unknown>;
	options?: { transport?: string };
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
			options?: { transport?: string },
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

	// The caller navigates in the same task, so a batched exposure never leaves the page.
	test("sends the exposure over sendBeacon", () => {
		stubFlag("test");
		assert.equal(resolvePlanRevealArm(), "test");
		assert.equal(captures.length, 1);
		assert.equal(captures[0].event, "$feature_flag_called");
		assert.equal(captures[0].properties?.$feature_flag_response, "test");
		assert.equal(captures[0].options?.transport, "sendBeacon");
	});

	// Exposure must stay scoped to assigned users, or the experiment denominator inflates.
	test("logs no exposure for a user outside the rollout", () => {
		stubFlag(false);
		assert.equal(resolvePlanRevealArm(), "unassigned");
		assert.equal(captures.length, 0);
	});
});
