import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { resolveZipEntryArm } from "@/address-search/experiments";

type StubWindow = {
	location: { search: string };
	posthog?: { getFeatureFlag: (key: string) => string | boolean | undefined };
};

const stub: StubWindow = { location: { search: "" } };
(globalThis as { window?: unknown }).window = stub;

function setFlag(value: string | boolean | undefined) {
	stub.posthog = { getFeatureFlag: () => value };
}

describe("resolveZipEntryArm", () => {
	beforeEach(() => {
		stub.location.search = "";
		stub.posthog = undefined;
	});

	test("test variant renders the zip entry", () => {
		setFlag("test");
		assert.equal(resolveZipEntryArm(), "zip");
	});

	test("control variant renders the address entry", () => {
		setFlag("control");
		assert.equal(resolveZipEntryArm(), "address");
	});

	test("unbucketed (flag false) renders the address entry", () => {
		setFlag(false);
		assert.equal(resolveZipEntryArm(), "address");
	});

	test("PostHog unavailable renders the address entry", () => {
		assert.equal(resolveZipEntryArm(), "address");
	});

	test("?zip_entry_test=test override wins without reading the flag", () => {
		stub.location.search = "?zip_entry_test=test";
		let flagRead = false;
		stub.posthog = {
			getFeatureFlag: () => {
				flagRead = true;
				return "control";
			},
		};
		assert.equal(resolveZipEntryArm(), "zip");
		assert.equal(flagRead, false);
	});

	test("?zip_entry_test=control override forces the address entry", () => {
		stub.location.search = "?zip_entry_test=control";
		setFlag("test");
		assert.equal(resolveZipEntryArm(), "address");
	});
});
