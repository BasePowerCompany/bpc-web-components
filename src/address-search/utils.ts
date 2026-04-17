import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";

export function parseGoogleAddressComponents(
	place: google.maps.places.Place,
): ParsedGoogleAddressComponents | undefined {
	if (!place.formattedAddress || !place.addressComponents) return undefined;

	const addr = place.addressComponents.reduce(
		(acc, data) => {
			data.types.forEach((type) => {
				acc[type] = data;
			});
			return acc;
		},
		{} as Record<string, google.maps.places.AddressComponent>,
	);

	// Only use true locality-type components. `administrative_area_level_2`
	// is the US county, which is virtually never the user-facing city —
	// Places omits `locality` for CDPs (e.g. "Cypress, TX"), which would
	// otherwise leak "Harris County" into the city field. When locality is
	// missing here, the flow falls back to Validation API's locality.
	const city =
		[addr.locality?.longText, addr.sublocality?.longText].filter(Boolean)[0] ||
		"";

	return {
		line1: [addr.street_number?.longText, addr.route?.longText]
			.filter(Boolean)
			.join(" "),
		line2: addr.subpremise?.longText || "",
		city,
		state: addr.administrative_area_level_1?.shortText || "",
		postalCode: addr.postal_code?.longText || "",
		country: addr.country?.shortText || "",
		latitude: place.location?.lat(),
		longitude: place.location?.lng(),
	};
}

export function parseAddress(
	place: google.maps.places.Place,
): AddressResult | undefined {
	if (!place.formattedAddress || !place.addressComponents) return undefined;

	const addr = place.addressComponents.reduce(
		(acc, data) => {
			data.types.forEach((type) => {
				acc[type] = data;
			});
			return acc;
		},
		{} as Record<string, google.maps.places.AddressComponent>,
	);

	const line1 = [
		addr.street_number?.longText,
		addr.route?.longText,
		addr.subpremise?.longText,
	]
		.filter(Boolean)
		.join(" ");

	// Only use true locality-type components. `administrative_area_level_2`
	// is the US county, which is virtually never the user-facing city —
	// Places omits `locality` for CDPs (e.g. "Cypress, TX"), which would
	// otherwise leak "Harris County" into the city field. When locality is
	// missing here, the flow falls back to Validation API's locality.
	const city =
		[addr.locality?.longText, addr.sublocality?.longText].filter(Boolean)[0] ||
		"";

	const address = {
		line1,
		city,
		state: addr.administrative_area_level_1?.shortText || "",
		postalCode: addr.postal_code?.longText || "",
		country: addr.country?.shortText || "",
		latitude: place.location?.lat(),
		longitude: place.location?.lng(),
	};

	return {
		formattedAddress: place.formattedAddress,
		address,
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
