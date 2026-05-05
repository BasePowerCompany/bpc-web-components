import { describe, expect, it } from "vitest";
import { interpretValidation } from "@/address-search/addressValidation";

describe("interpretValidation", () => {
	it("requires a unit when Google says subpremise is missing", () => {
		const result = interpretValidation({
			result: {
				verdict: {
					possibleNextAction: "CONFIRM_ADD_SUBPREMISES",
					addressComplete: true,
				},
				address: {
					missingComponentTypes: ["subpremise"],
				},
				uspsData: {
					dpvConfirmation: "D",
				},
			},
		});

		expect(result.kind).toBe("missing_subpremise");
		expect(result.unconfirmedFields).toEqual(["line2"]);
		expect(result.dpvConfirmation).toBe("D");
	});

	it("prefers confirmed USPS deliverability over weak subpremise flags", () => {
		const result = interpretValidation({
			result: {
				verdict: {
					possibleNextAction: "CONFIRM_ADD_SUBPREMISES",
					addressComplete: true,
				},
				address: {
					missingComponentTypes: ["subpremise"],
				},
				uspsData: {
					dpvConfirmation: "Y",
				},
			},
		});

		expect(result.kind).toBe("accept");
		expect(result.unconfirmedFields).toEqual(["line2"]);
	});

	it("asks users to confirm an entered unit when the unit is unconfirmed", () => {
		const result = interpretValidation({
			result: {
				verdict: {
					possibleNextAction: "CONFIRM",
					addressComplete: true,
				},
				address: {
					unconfirmedComponentTypes: ["subpremise"],
				},
				uspsData: {
					dpvConfirmation: "S",
				},
			},
		});

		expect(result.kind).toBe("confirm_subpremise");
		expect(result.unconfirmedFields).toEqual(["line2"]);
	});
});
