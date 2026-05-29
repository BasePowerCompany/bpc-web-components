import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AddressValidationKind } from "@/address-search/addressValidation";
import { interpretValidation } from "@/address-search/addressValidation";

type RawOverrides = {
	verdict?: Record<string, unknown>;
	address?: Record<string, unknown>;
	uspsData?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
};

const BASE_VERDICT = {
	possibleNextAction: "ACCEPT",
	inputGranularity: "PREMISE",
	validationGranularity: "PREMISE",
	geocodeGranularity: "PREMISE",
	addressComplete: true,
};

function makeRaw(overrides: RawOverrides = {}) {
	return {
		result: {
			verdict: { ...BASE_VERDICT, ...overrides.verdict },
			address: {
				formattedAddress: "2409 Moreno Street, Austin, TX 78723, USA",
				...overrides.address,
			},
			uspsData: { ...overrides.uspsData },
			metadata: { ...overrides.metadata },
		},
	};
}

describe("interpretValidation classification", () => {
	const cases: Array<[string, RawOverrides, AddressValidationKind]> = [
		[
			"DPV=Y, street record accepts",
			{ uspsData: { dpvConfirmation: "Y", addressRecordType: "S" } },
			"accept",
		],
		[
			"DPV=Y, street record, residential metadata accepts",
			{
				uspsData: { dpvConfirmation: "Y", addressRecordType: "S" },
				metadata: { residential: true },
			},
			"accept",
		],
		[
			"DPV=Y, street record, non-residential metadata asks unit question",
			{
				uspsData: { dpvConfirmation: "Y", addressRecordType: "S" },
				metadata: { residential: false },
			},
			"confirm_unit_requirement",
		],
		[
			"DPV=Y, non-residential with subpremise input accepts",
			{
				verdict: { inputGranularity: "SUB_PREMISE" },
				uspsData: { dpvConfirmation: "Y", addressRecordType: "S" },
				metadata: { residential: false },
			},
			"accept",
		],
		[
			"DPV=Y, building record without subpremise asks unit question",
			{ uspsData: { dpvConfirmation: "Y", addressRecordType: "H" } },
			"confirm_unit_requirement",
		],
		[
			"DPV=Y, building record with subpremise input accepts",
			{
				verdict: { inputGranularity: "SUB_PREMISE" },
				uspsData: { dpvConfirmation: "Y", addressRecordType: "H" },
			},
			"accept",
		],
		[
			"DPV=Y, default address asks unit question",
			{ uspsData: { dpvConfirmation: "Y", defaultAddress: true } },
			"confirm_unit_requirement",
		],
		[
			"DPV=D requires subpremise",
			{ uspsData: { dpvConfirmation: "D" } },
			"missing_subpremise",
		],
		[
			"DPV=S confirms subpremise",
			{ uspsData: { dpvConfirmation: "S" } },
			"confirm_subpremise",
		],
		["DPV=N blocks", { uspsData: { dpvConfirmation: "N" } }, "block"],
		["FIX action blocks", { verdict: { possibleNextAction: "FIX" } }, "block"],
		[
			"CONFIRM_ADD_SUBPREMISES requires subpremise",
			{ verdict: { possibleNextAction: "CONFIRM_ADD_SUBPREMISES" } },
			"missing_subpremise",
		],
		[
			"unconfirmed street number confirms street number",
			{ address: { unconfirmedComponentTypes: ["street_number"] } },
			"confirm_street_number",
		],
		[
			"ACCEPT with no DPV asks unit question",
			{ uspsData: {} },
			"confirm_unit_requirement",
		],
		[
			"missing addressComplete blocks when no stronger accept signal exists",
			{ verdict: { addressComplete: undefined } },
			"block",
		],
	];

	for (const [name, overrides, expectedKind] of cases) {
		test(`${name} -> ${expectedKind}`, () => {
			assert.equal(interpretValidation(makeRaw(overrides)).kind, expectedKind);
		});
	}

	test("USPS-driven missing subpremise highlights line2", () => {
		const result = interpretValidation(
			makeRaw({ uspsData: { dpvConfirmation: "D" } }),
		);

		assert.deepEqual(result.unconfirmedFields, ["line2"]);
	});

	test("USPS-driven confirm subpremise highlights line2", () => {
		const result = interpretValidation(
			makeRaw({ uspsData: { dpvConfirmation: "S" } }),
		);

		assert.deepEqual(result.unconfirmedFields, ["line2"]);
	});
});
