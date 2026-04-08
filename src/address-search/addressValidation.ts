import { getGoogleMapsApiKey } from "@/utils/googleMaps";

/**
 * Canonicalized address data extracted from the Address Validation API
 * response. When present, this is treated as the source of truth and is
 * merged into the selection so the frontend stays consistent with the
 * backend's own USPS-backed validation.
 */
export type ValidatedAddress = {
	formattedAddress: string;
	line1: string;
	city: string;
	state: string;
	/** 5-digit ZIP; any "-suffix" (ZIP+4) is stripped for backend consistency */
	postalCode: string;
	country: string;
};

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
	/** Canonicalized address from result.address.postalAddress, when available */
	validatedAddress?: ValidatedAddress;
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
		const requestBody = {
			address: {
				regionCode: "US",
				addressLines: [addressLine],
			},
		};
		console.log("[bpc-web-components] validateAddress request:", {
			addressLine,
			body: requestBody,
		});
		const response = await fetch(
			`https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody),
			},
		);

		if (!response.ok) {
			console.log("[bpc-web-components] validateAddress non-ok response:", {
				status: response.status,
				statusText: response.statusText,
			});
			return SAFE_DEFAULT;
		}

		const data = await response.json();
		console.log("[bpc-web-components] validateAddress response:", {
			addressLine,
			data,
		});
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
			validatedAddress: parseValidatedAddress(address),
		};
	} catch (error) {
		console.log("[bpc-web-components] validateAddress error:", error);
		return SAFE_DEFAULT;
	}
}

/**
 * Extracts the canonicalized address from the Address Validation API
 * response. Returns undefined when the response does not contain enough
 * data to be useful as a drop-in replacement for the Places selection.
 */
// biome-ignore lint/suspicious/noExplicitAny: narrow, untyped Google response shape
function parseValidatedAddress(address: any): ValidatedAddress | undefined {
	const formattedAddress: string | undefined = address?.formattedAddress;
	const postalAddress = address?.postalAddress;
	if (!formattedAddress || !postalAddress) return undefined;

	const rawPostalCode: string = postalAddress.postalCode ?? "";
	// Strip ZIP+4 suffix ("76226-2564" -> "76226") to match backend expectations.
	const postalCode = rawPostalCode.split("-")[0] ?? "";

	return {
		formattedAddress,
		line1: postalAddress.addressLines?.[0] ?? "",
		city: postalAddress.locality ?? "",
		state: postalAddress.administrativeArea ?? "",
		postalCode,
		country: postalAddress.regionCode ?? "",
	};
}
