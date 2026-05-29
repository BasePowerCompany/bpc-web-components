import { getGoogleMapsApiKey } from "@/utils/googleMaps";

/**
 * The action our UI should take for a validated address.
 *
 * - `accept`             — submit silently, Google + USPS both happy.
 * - `missing_subpremise` — Google says a subpremise is required (apartment/unit).
 *                          UX: require unit before submission.
 * - `confirm_subpremise` — user entered a unit but USPS/Google can't confirm it.
 *                          UX: show unit with warning, let user confirm or edit.
 * - `confirm_unit_requirement` — Google validated the street address but did
 *                          not give us a conclusive signal that no unit is
 *                          needed. UX: ask whether the user lives in a
 *                          multi-unit home; require unit only when they say yes.
 * - `confirm_street_number` — street number not confirmed by USPS (rural routes,
 *                          new construction, USPS blind spots). UX: show banner,
 *                          let user confirm or edit.
 * - `confirm_components` — other components (locality, route, postal_code) are
 *                          unconfirmed or were inferred/replaced. UX: highlight
 *                          the specific fields in the modal; let user confirm.
 * - `block`              — verdict is FIX / unresolvable. UX: red-tone banner
 *                          and edit-first framing, but the user can still
 *                          override (per principle #3 — override is always one
 *                          click away). Backend treats the submission as
 *                          confirmAddress=true and shouldn't re-open the gate.
 */
export type AddressValidationKind =
	| "accept"
	| "missing_subpremise"
	| "confirm_subpremise"
	| "confirm_unit_requirement"
	| "confirm_street_number"
	| "confirm_components"
	| "block";

export type UnitRequirementPromptReason =
	| "building_or_apartment_record"
	| "non_residential_premise"
	| "default_address"
	| "missing_usps_dpv"
	| "inconclusive_usps_dpv"
	| "unconfirmed_google";

/** Component types we can surface per-field in the modal UI. */
export type UnconfirmedFieldType =
	| "line1"
	| "line2"
	| "city"
	| "state"
	| "postalCode";

export type AddressValidationResult = {
	kind: AddressValidationKind;
	/** Component-type strings from Google (e.g. "subpremise", "locality") */
	unconfirmedComponentTypes: string[];
	missingComponentTypes: string[];
	/** UI-field names that should be highlighted in the modal */
	unconfirmedFields: UnconfirmedFieldType[];
	/** Raw verdict action: ACCEPT, CONFIRM, CONFIRM_ADD_SUBPREMISES, FIX */
	possibleNextAction: string;
	inputGranularity: string | null;
	validationGranularity: string | null;
	geocodeGranularity: string | null;
	addressComplete: boolean;
	hasUnconfirmedComponents: boolean;
	hasInferredComponents: boolean;
	hasReplacedComponents: boolean;
	/** USPS DPV verdict: Y=deliverable, D=primary OK/secondary required,
	 *  S=primary OK/secondary mismatch, N=not deliverable, null=no USPS data */
	dpvConfirmation: string | null;
	dpvFootnote: string | null;
	/** USPS record type: H=building/apartment, S=street record, etc. */
	addressRecordType: string | null;
	/** USPS found a default address but more specific addresses exist. */
	defaultAddress: boolean;
	/** Google metadata: residence vs business, not single-family vs multi-unit. */
	metadataResidential: boolean | null;
	/** Google's standardized formatted address — useful for logging / display */
	googleFormattedAddress: string | null;
	/** Why we asked the home-vs-unit question, if that prompt is shown. */
	unitRequirementPromptReason: UnitRequirementPromptReason | null;
	/** Locality as Google validated it. Populated even for CDPs (e.g. "Cypress, TX")
	 *  where Places Autocomplete omits the locality component — use this to
	 *  backfill the city field when parseGoogleAddressComponents returns empty. */
	validatedLocality: string | null;
};

export type AddressValidationInput =
	| string
	| {
			addressLines: string[];
			locality?: string;
			administrativeArea?: string;
			postalCode?: string;
	  };

export function validationEventProperties(
	validationResult: AddressValidationResult,
	validationSessionId?: string,
): Record<string, unknown> {
	return {
		...(validationSessionId ? { validationSessionId } : {}),
		kind: validationResult.kind,
		possibleNextAction: validationResult.possibleNextAction,
		inputGranularity: validationResult.inputGranularity,
		validationGranularity: validationResult.validationGranularity,
		geocodeGranularity: validationResult.geocodeGranularity,
		unconfirmedComponentTypes: validationResult.unconfirmedComponentTypes,
		missingComponentTypes: validationResult.missingComponentTypes,
		hasUnconfirmedComponents: validationResult.hasUnconfirmedComponents,
		hasInferredComponents: validationResult.hasInferredComponents,
		hasReplacedComponents: validationResult.hasReplacedComponents,
		dpvConfirmation: validationResult.dpvConfirmation,
		dpvFootnote: validationResult.dpvFootnote,
		addressRecordType: validationResult.addressRecordType,
		defaultAddress: validationResult.defaultAddress,
		metadataResidential: validationResult.metadataResidential,
		googleFormattedAddress: validationResult.googleFormattedAddress,
		unitRequirementPromptReason: validationResult.unitRequirementPromptReason,
	};
}

const SAFE_DEFAULT: AddressValidationResult = {
	kind: "accept",
	unconfirmedComponentTypes: [],
	missingComponentTypes: [],
	unconfirmedFields: [],
	possibleNextAction: "ACCEPT",
	inputGranularity: null,
	validationGranularity: null,
	geocodeGranularity: null,
	addressComplete: true,
	hasUnconfirmedComponents: false,
	hasInferredComponents: false,
	hasReplacedComponents: false,
	dpvConfirmation: null,
	dpvFootnote: null,
	addressRecordType: null,
	defaultAddress: false,
	metadataResidential: null,
	googleFormattedAddress: null,
	unitRequirementPromptReason: null,
	validatedLocality: null,
};

const COMPONENT_TO_FIELD: Record<string, UnconfirmedFieldType> = {
	street_number: "line1",
	route: "line1",
	subpremise: "line2",
	locality: "city",
	sublocality: "city",
	administrative_area_level_1: "state",
	postal_code: "postalCode",
};

function toField(componentType: string): UnconfirmedFieldType | undefined {
	return COMPONENT_TO_FIELD[componentType];
}

function dedupe<T>(values: T[]): T[] {
	return Array.from(new Set(values));
}

function compactPostalAddress(input: AddressValidationInput): {
	regionCode: "US";
	addressLines: string[];
	locality?: string;
	administrativeArea?: string;
	postalCode?: string;
} {
	if (typeof input === "string") {
		return { regionCode: "US", addressLines: [input] };
	}

	return {
		regionCode: "US",
		addressLines: input.addressLines.filter((line) => line.trim()),
		...(input.locality ? { locality: input.locality } : {}),
		...(input.administrativeArea
			? { administrativeArea: input.administrativeArea }
			: {}),
		...(input.postalCode ? { postalCode: input.postalCode } : {}),
	};
}

function unitRequirementPromptReason(params: {
	possibleNextAction: string;
	inputGranularity: string | null;
	addressComplete: boolean;
	unconfirmedComponentTypes: string[];
	missingComponentTypes: string[];
	unresolvedTokens: string[];
	dpvConfirmation: string | null;
	addressRecordType: string | null;
	defaultAddress: boolean;
	hasUnconfirmedComponents: boolean;
	metadataResidential: boolean | null;
}): UnitRequirementPromptReason | null {
	const {
		possibleNextAction,
		inputGranularity,
		addressComplete,
		unconfirmedComponentTypes,
		missingComponentTypes,
		unresolvedTokens,
		dpvConfirmation,
		addressRecordType,
		defaultAddress,
		hasUnconfirmedComponents,
		metadataResidential,
	} = params;

	if (!addressComplete || unresolvedTokens.length > 0) return null;
	if (inputGranularity === "SUB_PREMISE") return null;
	if (dpvConfirmation === "N") return null;
	if (
		possibleNextAction === "CONFIRM_ADD_SUBPREMISES" ||
		missingComponentTypes.includes("subpremise") ||
		unconfirmedComponentTypes.includes("subpremise")
	) {
		return null;
	}

	if (defaultAddress) {
		return "default_address";
	}

	if (addressRecordType === "H") {
		return "building_or_apartment_record";
	}

	if (metadataResidential === false) {
		return "non_residential_premise";
	}

	if (dpvConfirmation === "Y") return null;

	if (possibleNextAction === "CONFIRM" && !hasUnconfirmedComponents) {
		return "unconfirmed_google";
	}

	if (
		possibleNextAction === "CONFIRM" &&
		!unconfirmedComponentTypes.some((t) => COMPONENT_TO_FIELD[t])
	) {
		return "unconfirmed_google";
	}

	if (possibleNextAction === "ACCEPT" && dpvConfirmation == null) {
		return "missing_usps_dpv";
	}

	if (possibleNextAction === "ACCEPT" && dpvConfirmation !== "Y") {
		return "inconclusive_usps_dpv";
	}

	return null;
}

function classify(params: {
	possibleNextAction: string;
	inputGranularity: string | null;
	addressComplete: boolean;
	unconfirmedComponentTypes: string[];
	missingComponentTypes: string[];
	unresolvedTokens: string[];
	dpvConfirmation: string | null;
	addressRecordType: string | null;
	defaultAddress: boolean;
	hasUnconfirmedComponents: boolean;
	metadataResidential: boolean | null;
}): AddressValidationKind {
	const {
		possibleNextAction,
		inputGranularity,
		addressComplete,
		unconfirmedComponentTypes,
		missingComponentTypes,
		unresolvedTokens,
		dpvConfirmation,
		addressRecordType,
		defaultAddress,
		hasUnconfirmedComponents,
		metadataResidential,
	} = params;

	// Subpremise cases take priority over other unconfirmed components —
	// an apartment mismatch matters more than a city-spelling nit.
	if (
		possibleNextAction === "CONFIRM_ADD_SUBPREMISES" ||
		missingComponentTypes.includes("subpremise") ||
		dpvConfirmation === "D"
	) {
		return "missing_subpremise";
	}
	if (
		unconfirmedComponentTypes.includes("subpremise") ||
		dpvConfirmation === "S"
	) {
		return "confirm_subpremise";
	}

	// Block when the verdict says we can't resolve the primary address. Keep
	// this after subpremise handling because Google's `addressComplete` is
	// false for missing units too.
	if (
		possibleNextAction === "FIX" ||
		dpvConfirmation === "N" ||
		unresolvedTokens.length > 0 ||
		missingComponentTypes.some((t) => t !== "subpremise")
	) {
		return "block";
	}

	// Street number is the biggest SLA lever (66% of L7D failures).
	// USPS blind spots (rural routes, new construction) show up here with
	// possibleNextAction=ACCEPT but hasUnconfirmedComponents=true.
	if (unconfirmedComponentTypes.includes("street_number")) {
		return "confirm_street_number";
	}

	// Any other unconfirmed component (locality, route, postal_code) →
	// highlight the specific field in the modal. Only fire the modal when at
	// least one unconfirmed type maps to a visible form field — otherwise the
	// banner says "the highlighted fields" but nothing is highlighted (e.g.
	// `point_of_interest` and `country` aren't form fields).
	if (unconfirmedComponentTypes.some((t) => COMPONENT_TO_FIELD[t])) {
		return "confirm_components";
	}

	if (
		dpvConfirmation === "Y" &&
		!defaultAddress &&
		(inputGranularity === "SUB_PREMISE" ||
			(addressRecordType !== "H" && metadataResidential !== false))
	) {
		return "accept";
	}

	if (!addressComplete) {
		return "block";
	}

	if (
		unitRequirementPromptReason({
			possibleNextAction,
			inputGranularity,
			addressComplete,
			unconfirmedComponentTypes,
			missingComponentTypes,
			unresolvedTokens,
			dpvConfirmation,
			addressRecordType,
			defaultAddress,
			hasUnconfirmedComponents,
			metadataResidential,
		})
	) {
		return "confirm_unit_requirement";
	}

	return "accept";
}

export function requireSubpremise(
	validationResult: AddressValidationResult,
): AddressValidationResult {
	return {
		...validationResult,
		kind: "missing_subpremise",
		missingComponentTypes: dedupe([
			...validationResult.missingComponentTypes,
			"subpremise",
		]),
		unconfirmedFields: dedupe([...validationResult.unconfirmedFields, "line2"]),
	};
}

/**
 * Convert a raw Validation API response body into our UI-friendly result.
 * Exported for unit testing — no network dependency.
 */
// biome-ignore lint/suspicious/noExplicitAny: Google API response
export function interpretValidation(raw: any): AddressValidationResult {
	const result = raw?.result ?? {};
	const verdict = result.verdict ?? {};
	const address = result.address ?? {};
	const usps = result.uspsData ?? {};
	const metadata = result.metadata ?? {};

	const possibleNextAction: string = verdict.possibleNextAction ?? "ACCEPT";
	const inputGranularity: string | null = verdict.inputGranularity ?? null;
	const validationGranularity: string | null =
		verdict.validationGranularity ?? null;
	const geocodeGranularity: string | null = verdict.geocodeGranularity ?? null;
	const addressComplete: boolean = verdict.addressComplete === true;
	const unconfirmedComponentTypes: string[] =
		address.unconfirmedComponentTypes ?? [];
	const missingComponentTypes: string[] = address.missingComponentTypes ?? [];
	const unresolvedTokens: string[] = address.unresolvedTokens ?? [];
	const dpvConfirmation: string | null = usps.dpvConfirmation ?? null;
	const addressRecordType: string | null = usps.addressRecordType ?? null;
	const defaultAddress: boolean = usps.defaultAddress ?? false;
	const metadataResidential: boolean | null = metadata.residential ?? null;
	const hasUnconfirmedComponents: boolean =
		verdict.hasUnconfirmedComponents ?? false;

	const kind = classify({
		possibleNextAction,
		inputGranularity,
		addressComplete,
		unconfirmedComponentTypes,
		missingComponentTypes,
		unresolvedTokens,
		dpvConfirmation,
		addressRecordType,
		defaultAddress,
		hasUnconfirmedComponents,
		metadataResidential,
	});
	const promptReason =
		kind === "confirm_unit_requirement"
			? unitRequirementPromptReason({
					possibleNextAction,
					inputGranularity,
					addressComplete,
					unconfirmedComponentTypes,
					missingComponentTypes,
					unresolvedTokens,
					dpvConfirmation,
					addressRecordType,
					defaultAddress,
					hasUnconfirmedComponents,
					metadataResidential,
				})
			: null;

	const unconfirmedFields = dedupe(
		[
			...unconfirmedComponentTypes,
			...missingComponentTypes.filter((t) => t === "subpremise"),
			...(kind === "missing_subpremise" || kind === "confirm_subpremise"
				? ["subpremise"]
				: []),
		]
			.map(toField)
			.filter((f): f is UnconfirmedFieldType => Boolean(f)),
	);

	// Prefer the Google-validated locality, falling back to USPS's
	// standardized city. Validation returns `locality` even for CDPs
	// like "Cypress, TX" where Places Autocomplete does not.
	const localityComponent = (address.addressComponents ?? []).find(
		// biome-ignore lint/suspicious/noExplicitAny: Google API response
		(c: any) => c?.componentType === "locality",
	);
	const validatedLocality: string | null =
		localityComponent?.componentName?.text ??
		usps.standardizedAddress?.city ??
		null;

	return {
		kind,
		unconfirmedComponentTypes,
		missingComponentTypes,
		unconfirmedFields,
		possibleNextAction,
		inputGranularity,
		validationGranularity,
		geocodeGranularity,
		addressComplete,
		hasUnconfirmedComponents,
		hasInferredComponents: verdict.hasInferredComponents ?? false,
		hasReplacedComponents: verdict.hasReplacedComponents ?? false,
		dpvConfirmation,
		dpvFootnote: usps.dpvFootnote ?? null,
		addressRecordType,
		defaultAddress,
		metadataResidential,
		googleFormattedAddress: address.formattedAddress ?? null,
		unitRequirementPromptReason: promptReason,
		validatedLocality,
	};
}

/**
 * Call the Google Address Validation API. Returns the raw response body on
 * success or `null` on any failure (network error, non-2xx, missing key).
 * Separated from `interpretValidation` so the classifier can be tested
 * without mocking fetch.
 */
async function fetchValidation(
	input: AddressValidationInput,
	// biome-ignore lint/suspicious/noExplicitAny: Google API response
): Promise<any | null> {
	const apiKey = getGoogleMapsApiKey();
	const address = compactPostalAddress(input);
	if (address.addressLines.length === 0 || !apiKey) return null;

	try {
		const response = await fetch(
			`https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					address,
					enableUspsCass: true,
				}),
			},
		);
		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}

export async function validateAddress(
	input: AddressValidationInput,
): Promise<AddressValidationResult> {
	const raw = await fetchValidation(input);
	if (!raw) return SAFE_DEFAULT;
	return interpretValidation(raw);
}
