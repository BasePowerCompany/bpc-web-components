import type { AddressResult } from "@/address-search/types";

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
