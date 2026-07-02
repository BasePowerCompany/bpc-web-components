import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
	posthogOnFeatureFlags,
	resolveZipEntryArm,
} from "@/address-search/experiments";

type FlagCall = { send_event: boolean };

type StubWindow = {
	posthog?: {
		getFeatureFlag?: (
			key: string,
			options?: { send_event?: boolean },
		) => string | boolean | undefined;
		onFeatureFlags?: (callback: () => void) => void;
	};
};

const stub: StubWindow = {};
(globalThis as { window?: unknown }).window = stub;

// Records each getFeatureFlag call so tests can assert on exposure semantics:
// a call without `send_event: false` is what makes posthog-js log the
// $feature_flag_called exposure.
function stubFlag(value: string | boolean | undefined): FlagCall[] {
	const calls: FlagCall[] = [];
	stub.posthog = {
		getFeatureFlag: (_key, options) => {
			calls.push({ send_event: options?.send_event !== false });
			return value;
		},
	};
	return calls;
}

describe("resolveZipEntryArm", () => {
	beforeEach(() => {
		stub.posthog = undefined;
	});

	test("test variant renders the zip entry and logs exposure", () => {
		const calls = stubFlag("test");
		assert.equal(resolveZipEntryArm(), "zip");
		assert.deepEqual(calls, [{ send_event: false }, { send_event: true }]);
	});

	test("control variant renders the address entry and logs exposure", () => {
		const calls = stubFlag("control");
		assert.equal(resolveZipEntryArm(), "address");
		assert.deepEqual(calls, [{ send_event: false }, { send_event: true }]);
	});

	test("unbucketed (flag false) renders the address entry without exposure", () => {
		const calls = stubFlag(false);
		assert.equal(resolveZipEntryArm(), "address");
		assert.deepEqual(calls, [{ send_event: false }]);
	});

	test("flags not loaded (undefined) renders the address entry without exposure", () => {
		const calls = stubFlag(undefined);
		assert.equal(resolveZipEntryArm(), "address");
		assert.deepEqual(calls, [{ send_event: false }]);
	});

	test("PostHog unavailable renders the address entry", () => {
		assert.equal(resolveZipEntryArm(), "address");
	});
});

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
