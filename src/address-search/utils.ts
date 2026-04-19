import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";

export type ParseAddressOptions = {
	/**
	 * Used when Places Autocomplete omits `locality` (common for CDPs like
	 * Cypress, TX). Pass Validation API's `validatedLocality` here — the
	 * parser falls back to it instead of leaking county names into the city.
	 */
	cityFallback?: string | null;
};

/**
 * Map Google address components to a type-indexed lookup. Both parsers share
 * this — keeps the field-picking logic below DRY.
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

export function parseGoogleAddressComponents(
	place: google.maps.places.Place,
	options?: ParseAddressOptions,
): ParsedGoogleAddressComponents | undefined {
	if (!place.formattedAddress || !place.addressComponents) return undefined;
	const addr = indexByType(place.addressComponents);

	return {
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
	};
}

export function parseAddress(
	place: google.maps.places.Place,
	options?: ParseAddressOptions,
): AddressResult | undefined {
	if (!place.formattedAddress || !place.addressComponents) return undefined;
	const addr = indexByType(place.addressComponents);

	const line1 = [
		addr.street_number?.longText,
		addr.route?.longText,
		addr.subpremise?.longText,
	]
		.filter(Boolean)
		.join(" ");

	return {
		formattedAddress: place.formattedAddress,
		address: {
			line1,
			city: resolveCity(addr, options?.cityFallback),
			state: addr.administrative_area_level_1?.shortText || "",
			postalCode: addr.postal_code?.longText || "",
			country: addr.country?.shortText || "",
			latitude: place.location?.lat(),
			longitude: place.location?.lng(),
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
