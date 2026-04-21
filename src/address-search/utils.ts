import type { AddressResult } from "@/address-search/types";

export type ParseAddressOptions = {
	/**
	 * Used when Places Autocomplete omits `locality` (common for CDPs like
	 * Cypress, TX). Pass Validation API's `validatedLocality` here — the
	 * parser falls back to it instead of leaking county names into the city.
	 */
	cityFallback?: string | null;
};

/**
 * Map Google address components to a type-indexed lookup.
 */
function indexByType(
	components: google.maps.places.AddressComponent[],
): Record<string, google.maps.places.AddressComponent> {
	return components.reduce(
		(acc, data) => {
			for (const type of data.types) {
				acc[type] = data;
			}
			return acc;
		},
		{} as Record<string, google.maps.places.AddressComponent>,
	);
}

/**
 * Resolve the user-facing city. Only `locality` / `sublocality` are safe to
 * use — `administrative_area_level_2` is the US county and almost never the
 * city the user would write. Falls back to `cityFallback` (typically from the
 * Validation API's locality) when Places omits the component entirely.
 */
function resolveCity(
	addr: Record<string, google.maps.places.AddressComponent>,
	cityFallback: string | null | undefined,
): string {
	return (
		addr.locality?.longText || addr.sublocality?.longText || cityFallback || ""
	);
}

/**
 * Parse a Google `Place` into the internal `AddressResult` shape. `line1` is
 * the street (street_number + route) and `line2` is the unit (subpremise),
 * kept separate so the confirm modal can edit each independently. Use
 * `toSubmittedAddress` at the submission boundary to fold them back together
 * for the backend.
 */
export function parseAddress(
	place: google.maps.places.Place,
	options?: ParseAddressOptions,
): AddressResult | undefined {
	if (!place.formattedAddress || !place.addressComponents) return undefined;
	const addr = indexByType(place.addressComponents);

	return {
		formattedAddress: place.formattedAddress,
		address: {
			line1: [addr.street_number?.longText, addr.route?.longText]
				.filter(Boolean)
				.join(" "),
			line2: addr.subpremise?.longText || "",
			city: resolveCity(addr, options?.cityFallback),
			state: addr.administrative_area_level_1?.shortText || "",
			postalCode: addr.postal_code?.longText || "",
			country: addr.country?.shortText || "",
			latitude: place.location?.lat(),
			longitude: place.location?.lng(),
		},
	};
}

/**
 * Fold the internal two-line address into the single-line shape the backend
 * expects. Call at the HTTP boundary only (currently inside `fetchHydration`).
 * The backend at `/api/address-router` reads `selection.address.line1` as the
 * joined street + unit string and has no concept of `line2`.
 *
 * Idempotent: a hydration-response address that already has `line2` absent
 * round-trips unchanged.
 */
export function toSubmittedAddress(selection: AddressResult): AddressResult {
	const { line2, line1, ...rest } = selection.address;
	const joinedLine1 = [line1.trim(), (line2 ?? "").trim()]
		.filter(Boolean)
		.join(" ");
	return {
		formattedAddress: selection.formattedAddress,
		address: {
			...rest,
			line1: joinedLine1,
		},
	};
}

export const posthogCapture = (
	eventName: string,
	// biome-ignore lint/suspicious/noExplicitAny: Posthog args are any
	properties: Record<string, any>,
) => {
	if (
		typeof window !== "undefined" &&
		// biome-ignore lint/suspicious/noExplicitAny: Posthog is any
		(window as unknown as { posthog?: any }).posthog
	) {
		// biome-ignore lint/suspicious/noExplicitAny: Posthog is any
		const posthog = (window as unknown as { posthog?: any }).posthog;
		posthog.capture(eventName, properties);
	}
};
