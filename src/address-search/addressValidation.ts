import { getGoogleMapsApiKey } from "@/utils/googleMaps";

export type AddressValidationResult = {
	requiresSubpremise: boolean;
};

const SAFE_DEFAULT: AddressValidationResult = { requiresSubpremise: false };

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

		const requiresSubpremise =
			data?.result?.verdict?.possibleNextAction === "CONFIRM_ADD_SUBPREMISES";

		return { requiresSubpremise };
	} catch {
		return SAFE_DEFAULT;
	}
}
