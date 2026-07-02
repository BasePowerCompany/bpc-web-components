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

// Minimal surface of the posthog-js snippet loaded by the embedding page (see
// index.html). `posthog` is undefined until the snippet runs, so callers reach
// it through `?.` — this is client-only embed code, so `window` always exists.
interface PostHogLike {
	capture(event: string, properties?: Record<string, unknown>): void;
	getFeatureFlag(key: string): string | boolean | undefined;
	onFeatureFlags(callback: () => void): void;
}

declare global {
	interface Window {
		posthog?: PostHogLike;
	}
}

export const posthogCapture = (
	eventName: string,
	properties: Record<string, unknown>,
) => {
	window.posthog?.capture(eventName, properties);
};

/**
 * Read a PostHog feature flag / experiment variant client-side. Returns the
 * variant string (e.g. "control" / "test"), or `undefined` when PostHog is
 * unavailable or flags haven't loaded — callers should treat `undefined` as
 * the control/default behavior. Calling this also records the experiment
 * exposure ($feature_flag_called), so only call it once the user is eligible.
 */
export const posthogGetFeatureFlag = (
	flagKey: string,
): string | boolean | undefined => window.posthog?.getFeatureFlag(flagKey);

/**
 * Run `callback` once PostHog's feature flags have loaded (immediately if they
 * already have). Returns `false` when PostHog isn't on the page, so callers
 * can fall back without waiting.
 */
export const posthogOnFeatureFlags = (callback: () => void): boolean => {
	if (!window.posthog?.onFeatureFlags) return false;
	window.posthog.onFeatureFlags(callback);
	return true;
};
