import type {
	AddressResult,
	HydrationResult,
	ZipRoutingResult,
} from "@/address-search/types";

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

export function fetchZipRouting(zipCode: string): Promise<ZipRoutingResult> {
	return fetch(
		`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/zip-router`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ zip_code: zipCode }),
		},
	)
		.then((res) => res.json() as Promise<ZipRoutingResult>)
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
