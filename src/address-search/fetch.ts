import type { AddressResult, HydrationResult } from "@/address-search/types";

export function fetchHydration(
	selection: AddressResult,
	confirmAddress: boolean = false,
	isEnergyOnly: boolean = false,
): Promise<HydrationResult> {
	return fetch(
		`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/address-router`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				selection,
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

export type ValidateAddressResult = {
	city: string;
	state: string;
	country: string;
};

export function validateAddress(
	address: string,
): Promise<ValidateAddressResult | null> {
	return fetch(
		`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/validate-address`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ address }),
		},
	)
		.then((res) => {
			if (!res.ok) return null;
			return res.json() as Promise<ValidateAddressResult>;
		})
		.catch(() => null);
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
