import { getGoogleMapsApiKey } from "@/utils/googleMaps";

export type AddressValidationResult = {
	/** Raw verdict action from the API: ACCEPT, CONFIRM, CONFIRM_ADD_SUBPREMISES, FIX */
	possibleNextAction: string;
	addressComplete: boolean;
	hasUnconfirmedComponents: boolean;
	hasInferredComponents: boolean;
	hasReplacedComponents: boolean;
	/** Component types missing from the address (e.g. "subpremise") */
	missingComponentTypes: string[];
	/** Component types present but not confirmed (e.g. "postal_code", "locality") */
	unconfirmedComponentTypes: string[];
	/** Convenience flag: true when possibleNextAction is CONFIRM_ADD_SUBPREMISES */
	requiresSubpremise: boolean;
};

const SAFE_DEFAULT: AddressValidationResult = {
	possibleNextAction: "ACCEPT",
	addressComplete: true,
	hasUnconfirmedComponents: false,
	hasInferredComponents: false,
	hasReplacedComponents: false,
	missingComponentTypes: [],
	unconfirmedComponentTypes: [],
	requiresSubpremise: false,
};

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
		const verdict = data?.result?.verdict ?? {};
		const address = data?.result?.address ?? {};

		const possibleNextAction: string = verdict.possibleNextAction ?? "ACCEPT";

		return {
			possibleNextAction,
			addressComplete: verdict.addressComplete ?? true,
			hasUnconfirmedComponents: verdict.hasUnconfirmedComponents ?? false,
			hasInferredComponents: verdict.hasInferredComponents ?? false,
			hasReplacedComponents: verdict.hasReplacedComponents ?? false,
			missingComponentTypes: address.missingComponentTypes ?? [],
			unconfirmedComponentTypes: address.unconfirmedComponentTypes ?? [],
			requiresSubpremise: possibleNextAction === "CONFIRM_ADD_SUBPREMISES",
		};
	} catch {
		return SAFE_DEFAULT;
	}
}
