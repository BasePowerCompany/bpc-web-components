import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rebaseToZipFunnel } from "@/address-search/zipFunnel";

// The helper resolves relative URLs against the page origin.
(globalThis as { window?: unknown }).window = {
	location: { origin: "https://www.basepowercompany.com" },
};

describe("rebaseToZipFunnel", () => {
	test("rebases the canonical DEREG funnel URL, preserving host and query", () => {
		assert.equal(
			rebaseToZipFunnel(
				"https://join.basepowercompany.com/join-now?postal_code=75201&utility=DEREG",
			),
			"https://join.basepowercompany.com/join-now-zip?postal_code=75201&utility=DEREG",
		);
	});

	test("rebases /join-now without a query string", () => {
		assert.equal(
			rebaseToZipFunnel("https://join.basepowercompany.com/join-now"),
			"https://join.basepowercompany.com/join-now-zip",
		);
	});

	test("leaves other utility destinations untouched", () => {
		for (const url of [
			"/farmers/join?postal_code=76226&utility=FARMERS",
			"/gvec/join?postal_code=78155&utility=GVEC",
			"https://www.basepowercompany.com/illinois/join?postal_code=60601",
		]) {
			assert.equal(rebaseToZipFunnel(url), url);
		}
	});

	test("leaves the waitlist redirect untouched", () => {
		assert.equal(
			rebaseToZipFunnel("/join-waitlist?postal_code=79936"),
			"/join-waitlist?postal_code=79936",
		);
	});

	test("does not prefix-match paths that merely start with /join-now", () => {
		assert.equal(
			rebaseToZipFunnel("https://join.basepowercompany.com/join-nowhere"),
			"https://join.basepowercompany.com/join-nowhere",
		);
	});
});
