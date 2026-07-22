import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { posthogOnFeatureFlags } from "@/address-search/experiments";

type StubWindow = {
	posthog?: {
		onFeatureFlags?: (callback: () => void) => void;
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
