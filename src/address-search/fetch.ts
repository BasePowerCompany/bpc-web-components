import type {
	AddressResult,
	EnergyOnlyUtilitiesResult,
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

// Matches flagGate's FLAG_WAIT_TIMEOUT_MS: the visitor is waiting on a submit,
// and an unanswered lookup must degrade rather than strand them on the spinner.
const ENERGY_UTILITY_TIMEOUT_MS = 1500;

/**
 * Energy-only utilities serving `zipCode` (growth `GetEnergyOnlyUtilityFromZip`,
 * via the dashboard-web BFF). Never rejects: every failure returns
 * `success: false` so the caller can continue without a utility.
 *
 * Wire shape (base-monorepo #36903): request `{ zip_code }`, response
 * `{ success, data: { utilities: [{ name, value }] } }`. `value` is the internal
 * code the funnel reads; `name` is the display label, unused until a zip
 * straddling a TDSP boundary needs the picker.
 */
export async function fetchEnergyOnlyUtilities(
	zipCode: string,
): Promise<EnergyOnlyUtilitiesResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ENERGY_UTILITY_TIMEOUT_MS);
	try {
		const res = await fetch(
			`${import.meta.env.VITE_BPC_DASHBOARD_WEB_HOST}/api/energy-only-utility`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ zip_code: zipCode }),
				signal: controller.signal,
			},
		);
		// Checked here unlike the sibling routes above: a non-2xx must read as "no
		// utility" and let the visitor through, not as a body worth parsing.
		if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

		const body: unknown = await res.json();
		const raw = (body as { data?: { utilities?: unknown } })?.data?.utilities;
		if (!Array.isArray(raw)) {
			return { success: false, error: "Unexpected response shape" };
		}
		return {
			success: true,
			utilities: raw
				.map((entry) => (entry as { value?: unknown })?.value)
				.filter(
					(utility): utility is string =>
						typeof utility === "string" && !!utility,
				),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	} finally {
		clearTimeout(timer);
	}
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
