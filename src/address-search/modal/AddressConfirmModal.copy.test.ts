import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AddressValidationKind } from "@/address-search/addressValidation";
import { copyFor } from "@/address-search/modal/AddressConfirmModal.copy";

const KINDS: AddressValidationKind[] = [
	"accept",
	"missing_subpremise",
	"confirm_subpremise",
	"confirm_unit_requirement",
	"confirm_street_number",
	"confirm_components",
	"block",
];

// A business visitor who sees "apartment" mid-flow is told the page is for someone else.
describe("business confirm copy", () => {
	for (const kind of KINDS) {
		test(`${kind} has no home wording`, () => {
			const text = JSON.stringify(copyFor(kind, [], true));
			assert.doesNotMatch(text, /apartment|home/i);
		});
	}

	test("home copy is unchanged when the flag is off", () => {
		assert.deepEqual(
			copyFor("missing_subpremise"),
			copyFor("missing_subpremise", [], false),
		);
		assert.match(copyFor("missing_subpremise").line2ErrorText, /apartment/);
	});
});
