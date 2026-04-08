import type { ValidatedAddress } from "@/address-search/addressValidation";
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

	const city =
		[
			addr.locality?.longText,
			addr.sublocality?.longText,
			addr.administrative_area_level_2?.longText,
		].filter(Boolean)[0] || "";

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

	const city =
		[
			addr.locality?.longText,
			addr.sublocality?.longText,
			addr.administrative_area_level_2?.longText,
		].filter(Boolean)[0] || "";

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

/**
 * Produces a new AddressResult where the street/city/state/ZIP/country come
 * from the Address Validation API response. Places lat/lng is preserved
 * because validation's coordinates are re-geocoded from text and may drift
 * from the specific place the user selected.
 */
export function mergeValidatedSelection(
	selection: AddressResult,
	validated: ValidatedAddress,
): AddressResult {
	return {
		formattedAddress: validated.formattedAddress,
		address: {
			line1: validated.line1 || selection.address.line1,
			city: validated.city || selection.address.city,
			state: validated.state || selection.address.state,
			postalCode: validated.postalCode || selection.address.postalCode,
			country: validated.country || selection.address.country,
			latitude: selection.address.latitude,
			longitude: selection.address.longitude,
			externalId: selection.address.externalId,
		},
	};
}

/**
 * Produces a new ParsedGoogleAddressComponents with the validated fields
 * merged in. `line2` (subpremise) is intentionally left untouched because
 * it is user-driven via the confirmation modal and is not part of the
 * validation response when the user has not yet entered one.
 */
export function mergeValidatedGoogleComponents(
	components: ParsedGoogleAddressComponents,
	validated: ValidatedAddress,
): ParsedGoogleAddressComponents {
	return {
		...components,
		line1: validated.line1 || components.line1,
		city: validated.city || components.city,
		state: validated.state || components.state,
		postalCode: validated.postalCode || components.postalCode,
		country: validated.country || components.country,
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
