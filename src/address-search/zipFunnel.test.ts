import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rebaseToZipFunnel } from "@/address-search/zipFunnel";

// The helper resolves relative URLs against the page origin.
(globalThis as { window?: unknown }).window = {
	location: { origin: "https://www.basepowercompany.com" },
};

describe("rebaseToZipFunnel", () => {
	test("rebases the canonical deregulated funnel URL, preserving host and query", () => {
		assert.equal(
			rebaseToZipFunnel(
				"https://join.basepowercompany.com/join-now?postal_code=75201&utility=ONCOR",
			),
			"https://join.basepowercompany.com/join-now-zip?postal_code=75201&utility=ONCOR",
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
		]) {
			assert.equal(rebaseToZipFunnel(url), url);
		}
	});

	// Unconditional on purpose: an Illinois zip typed into ANY zip widget belongs
	// on the zip route, whether or not that widget is the ComEd experiment's. The
	// experiment gates which entry renders, never where a rebased zip is sent.
	test("rebases the ComEd/Illinois canonical URL to a different origin, preserving query", () => {
		assert.equal(
			rebaseToZipFunnel(
				"https://www.basepowercompany.com/illinois/join?postal_code=60601",
			),
			"https://join.basepowercompany.com/illinois/join-zip?postal_code=60601",
		);
	});

	test("rebases a relative /illinois/join, resolved against window.location.origin", () => {
		assert.equal(
			rebaseToZipFunnel("/illinois/join?postal_code=60601"),
			"https://join.basepowercompany.com/illinois/join-zip?postal_code=60601",
		);
	});

	// Origin-agnostic on purpose: responses may be relative, and pinning an origin
	// would silently serve control on staging and apex hosts.
	test("rebases a relative /join-now, resolved against window.location.origin", () => {
		assert.equal(
			rebaseToZipFunnel("/join-now?postal_code=75201"),
			"https://www.basepowercompany.com/join-now-zip?postal_code=75201",
		);
	});

	test("rebases /illinois/join regardless of which host served it", () => {
		assert.equal(
			rebaseToZipFunnel(
				"https://join.basepowercompany.com/illinois/join?postal_code=60601",
			),
			"https://join.basepowercompany.com/illinois/join-zip?postal_code=60601",
		);
	});

	test("carries a fragment across the rebase", () => {
		assert.equal(
			rebaseToZipFunnel("https://join.basepowercompany.com/join-now?a=1#form"),
			"https://join.basepowercompany.com/join-now-zip?a=1#form",
		);
		assert.equal(
			rebaseToZipFunnel(
				"https://www.basepowercompany.com/illinois/join?a=1#form",
			),
			"https://join.basepowercompany.com/illinois/join-zip?a=1#form",
		);
	});

	test("does not re-rebase an already-zip-first Illinois URL", () => {
		const url =
			"https://join.basepowercompany.com/illinois/join-zip?postal_code=60601";
		assert.equal(rebaseToZipFunnel(url), url);
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
