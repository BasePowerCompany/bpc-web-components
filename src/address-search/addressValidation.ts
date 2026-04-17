import { getGoogleMapsApiKey } from "@/utils/googleMaps";

/**
 * The action our UI should take for a validated address.
 *
 * - `accept`             — submit silently, Google + USPS both happy.
 * - `missing_subpremise` — Google says a subpremise is required (apartment/unit).
 *                          UX: prompt for unit with equal-weight "single-family home" escape.
 * - `confirm_subpremise` — user entered a unit but USPS/Google can't confirm it.
 *                          UX: show unit with warning, let user confirm or edit.
 * - `confirm_street_number` — street number not confirmed by USPS (rural routes,
 *                          new construction, USPS blind spots). UX: show banner,
 *                          let user confirm or edit.
 * - `confirm_components` — other components (locality, route, postal_code) are
 *                          unconfirmed or were inferred/replaced. UX: highlight
 *                          the specific fields in the modal; let user confirm.
 * - `block`              — verdict is FIX / unresolvable. UX: don't submit.
 */
export type AddressValidationKind =
	| "accept"
	| "missing_subpremise"
	| "confirm_subpremise"
	| "confirm_street_number"
	| "confirm_components"
	| "block";

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
	addressComplete: boolean;
	hasUnconfirmedComponents: boolean;
	hasInferredComponents: boolean;
	hasReplacedComponents: boolean;
	/** USPS DPV verdict: Y=deliverable, D=primary OK/secondary required,
	 *  S=primary OK/secondary mismatch, N=not deliverable, null=no USPS data */
	dpvConfirmation: string | null;
	dpvFootnote: string | null;
	/** Google's standardized formatted address — useful for logging / display */
	googleFormattedAddress: string | null;
	/** Locality as Google validated it. Populated even for CDPs (e.g. "Cypress, TX")
	 *  where Places Autocomplete omits the locality component — use this to
	 *  backfill the city field when parseGoogleAddressComponents returns empty. */
	validatedLocality: string | null;
	/** Convenience flag: true when a subpremise prompt should be shown */
	requiresSubpremise: boolean;
};

const SAFE_DEFAULT: AddressValidationResult = {
	kind: "accept",
	unconfirmedComponentTypes: [],
	missingComponentTypes: [],
	unconfirmedFields: [],
	possibleNextAction: "ACCEPT",
	addressComplete: true,
	hasUnconfirmedComponents: false,
	hasInferredComponents: false,
	hasReplacedComponents: false,
	dpvConfirmation: null,
	dpvFootnote: null,
	googleFormattedAddress: null,
	validatedLocality: null,
	requiresSubpremise: false,
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

function classify(params: {
	possibleNextAction: string;
	addressComplete: boolean;
	unconfirmedComponentTypes: string[];
	missingComponentTypes: string[];
	unresolvedTokens: string[];
	dpvConfirmation: string | null;
}): AddressValidationKind {
	const {
		possibleNextAction,
		addressComplete,
		unconfirmedComponentTypes,
		missingComponentTypes,
		unresolvedTokens,
		dpvConfirmation,
	} = params;

	// Fast path: USPS DPV confirms deliverable (primary + secondary, or no
	// secondary needed). This is the strongest single signal — when present
	// it implies Google's verdict is also clean. Verified over a 40-address
	// probe: 0 DPV=Y cases had any unconfirmed components or non-ACCEPT action.
	if (dpvConfirmation === "Y") {
		return "accept";
	}

	// Block when the verdict says we can't resolve the address.
	if (
		possibleNextAction === "FIX" ||
		!addressComplete ||
		unresolvedTokens.length > 0
	) {
		return "block";
	}

	// Subpremise cases take priority over other unconfirmed components —
	// an apartment mismatch matters more than a city-spelling nit.
	if (
		possibleNextAction === "CONFIRM_ADD_SUBPREMISES" ||
		missingComponentTypes.includes("subpremise")
	) {
		return "missing_subpremise";
	}
	if (unconfirmedComponentTypes.includes("subpremise")) {
		return "confirm_subpremise";
	}

	// Street number is the biggest SLA lever (66% of L7D failures).
	// USPS blind spots (rural routes, new construction) show up here with
	// possibleNextAction=ACCEPT but hasUnconfirmedComponents=true.
	if (unconfirmedComponentTypes.includes("street_number")) {
		return "confirm_street_number";
	}

	// Any other unconfirmed component (locality, route, postal_code) →
	// highlight the specific field in the modal.
	if (unconfirmedComponentTypes.length > 0) {
		return "confirm_components";
	}

	return "accept";
}

export async function validateAddress(
	addressLine: string,
): Promise<AddressValidationResult> {
	const apiKey = getGoogleMapsApiKey();
	if (!addressLine.trim() || !apiKey) {
		return SAFE_DEFAULT;
	}

	try {
		const response = await fetch(
			`https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					address: {
						regionCode: "US",
						addressLines: [addressLine],
					},
				}),
			},
		);

		if (!response.ok) {
			return SAFE_DEFAULT;
		}

		const data = await response.json();
		const result = data?.result ?? {};
		const verdict = result.verdict ?? {};
		const address = result.address ?? {};
		const usps = result.uspsData ?? {};

		const possibleNextAction: string = verdict.possibleNextAction ?? "ACCEPT";
		const addressComplete: boolean = verdict.addressComplete ?? true;
		const unconfirmedComponentTypes: string[] =
			address.unconfirmedComponentTypes ?? [];
		const missingComponentTypes: string[] = address.missingComponentTypes ?? [];
		const unresolvedTokens: string[] = address.unresolvedTokens ?? [];
		const dpvConfirmation: string | null = usps.dpvConfirmation ?? null;

		const kind = classify({
			possibleNextAction,
			addressComplete,
			unconfirmedComponentTypes,
			missingComponentTypes,
			unresolvedTokens,
			dpvConfirmation,
		});

		const unconfirmedFields = Array.from(
			new Set(
				[
					...unconfirmedComponentTypes,
					...missingComponentTypes.filter((t) => t === "subpremise"),
				]
					.map(toField)
					.filter((f): f is UnconfirmedFieldType => Boolean(f)),
			),
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
			addressComplete,
			hasUnconfirmedComponents: verdict.hasUnconfirmedComponents ?? false,
			hasInferredComponents: verdict.hasInferredComponents ?? false,
			hasReplacedComponents: verdict.hasReplacedComponents ?? false,
			dpvConfirmation,
			dpvFootnote: usps.dpvFootnote ?? null,
			googleFormattedAddress: address.formattedAddress ?? null,
			validatedLocality,
			requiresSubpremise: kind === "missing_subpremise",
		};
	} catch {
		return SAFE_DEFAULT;
	}
}
