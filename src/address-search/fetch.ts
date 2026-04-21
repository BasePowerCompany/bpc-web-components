import type { AddressResult, HydrationResult } from "@/address-search/types";
import { toSubmittedAddress } from "@/address-search/utils";

export function fetchHydration(
	selection: AddressResult,
	confirmAddress: boolean = false,
	isEnergyOnly: boolean = false,
): Promise<HydrationResult> {
	// Serialize the internal two-line shape into the single-line wire shape
	// the backend expects — this is the one and only submission boundary.
	const submittedSelection = toSubmittedAddress(selection);
	return fetch(
		`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/address-router`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				selection: submittedSelection,
				confirm_address: confirmAddress,
				is_energy_only: isEnergyOnly,
			}),
		},
	)
		.then((res) => res.json() as Promise<HydrationResult>)
		.catch((error) => {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		});
}

export function setUtilityUserConfirmed(utility: string, externalId: string) {
	return fetch(
		`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/utility-select`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				utilityName: utility,
				externalId: externalId,
			}),
		},
	);
}
