import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
	posthogOnFeatureFlags,
	resolveZipEntryArm,
} from "@/address-search/experiments";

type StubWindow = {
	posthog?: {
		getFeatureFlag?: (key: string) => string | boolean | undefined;
		onFeatureFlags?: (callback: () => void) => void;
	};
};

const stub: StubWindow = {};
(globalThis as { window?: unknown }).window = stub;

describe("resolveZipEntryArm", () => {
	beforeEach(() => {
		stub.posthog = undefined;
	});

	test("test variant renders the zip entry", () => {
		stub.posthog = { getFeatureFlag: () => "test" };
		assert.equal(resolveZipEntryArm(), "zip");
	});

	test("control variant renders the address entry", () => {
		stub.posthog = { getFeatureFlag: () => "control" };
		assert.equal(resolveZipEntryArm(), "address");
	});

	test("unbucketed (flag false) renders the address entry", () => {
		stub.posthog = { getFeatureFlag: () => false };
		assert.equal(resolveZipEntryArm(), "address");
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
