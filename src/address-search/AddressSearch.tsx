"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddressResult } from "@/address-search/types";
import { parseAddress } from "@/address-search/utils";
import { useMapsLibrary } from "@/utils/useMapsLibrary";
import { Autocomplete, type Result } from "./Autocomplete";

export type AddressSearchProps = {
	placeholder?: string;
	cta?: string;
	onSelect?: (detail: { selection: AddressResult | undefined }) => void;
	portalRoot: ShadowRoot;
	zIndex: number;
};

export function AddressSearch({
	zIndex,
	onSelect,
	placeholder,
	cta,
	portalRoot,
}: AddressSearchProps) {
	const places = useMapsLibrary("places");
	const token = useRef<google.maps.places.AutocompleteSessionToken | null>(
		null,
	);
	const placesRef = useRef<
		Record<string, google.maps.places.AutocompleteSuggestion | undefined>
	>({});
	const correctedTextRef = useRef<Record<string, string>>({});
	const [inputValue, setInputValue] = useState<string>("");
	const searchQuery = inputValue.trim();
	const [cache, setCache] = useState<
		Record<
			string,
			Promise<google.maps.places.AutocompleteSuggestion[]> | undefined
		>
	>({});
	const [placesResult, setPlacesResult] = useState<
		google.maps.places.AutocompleteSuggestion[]
	>([]);

	useEffect(() => {
		if (!places) return;

		// Create new token if not exists
		if (!token.current) {
			token.current = new places.AutocompleteSessionToken();
		}

		const curToken = token.current;
		setCache((prev) => {
			if (prev[searchQuery] || !searchQuery) {
				return prev;
			}

			return {
				...prev,
				[searchQuery]:
					places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
						input: searchQuery,
						sessionToken: curToken,
						// region: "US", // Don't restrict to US -- this changes the way the formatted address is returned
						language: "en",
						includedPrimaryTypes: ["street_address"],
					}).then(async ({ suggestions }) => {
						suggestions.forEach((suggestion) => {
							if (!suggestion.placePrediction?.placeId) return;
							placesRef.current[suggestion.placePrediction.placeId] =
								suggestion;
						});

						// Use Address Validation API to get correct USPS city names.
						// Autocomplete secondaryText returns CDPs like "Briarcliff"
						// instead of the postal city like "Austin".
						await Promise.all(
							suggestions.map(async (suggestion) => {
								const placeId = suggestion.placePrediction?.placeId;
								const streetAddress =
									suggestion.placePrediction?.mainText?.text;
								if (
									!placeId ||
									!streetAddress ||
									correctedTextRef.current[placeId]
								)
									return;

								// Use whichever has more info: user's input (may include
								// city/state) or the autocomplete street address
								const addressInput =
									searchQuery.length > streetAddress.length
										? searchQuery
										: streetAddress;

								try {
									const { AddressValidation } =
										await google.maps.importLibrary("addressValidation");
									const validation =
										await AddressValidation.fetchAddressValidation({
											address: {
												addressLines: [addressInput],
												regionCode: "US",
											},
											uspsCASSEnabled: true,
										});

									const uspsCity =
										validation.uspsData?.standardizedAddress?.city;
									const postalAddress = validation.address?.postalAddress;
									const rawCity = uspsCity || postalAddress?.locality || "";
									// USPS city is uppercase (e.g. "AUSTIN"), title-case it
									const city = rawCity
										.toLowerCase()
										.replace(/\b\w/g, (c: string) => c.toUpperCase());
									const state = postalAddress?.administrativeArea || "";
									const country =
										postalAddress?.regionCode === "US"
											? "USA"
											: (postalAddress?.regionCode ?? "");

									if (city) {
										correctedTextRef.current[placeId] = [city, state, country]
											.filter(Boolean)
											.join(", ");
									}
								} catch {
									// Fall back to default secondaryText on error
								}
							}),
						);

						return suggestions;
					}),
			};
		});
	}, [places, searchQuery]);

	useEffect(() => {
		let stale = false;
		if (!searchQuery) {
			setPlacesResult([]);
			return;
		}

		const cached = cache[searchQuery];
		if (cached) {
			cached.then((suggestions) => {
				if (!stale) setPlacesResult(suggestions);
			});
		}
		return () => {
			stale = true;
		};
	}, [cache, searchQuery]);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const place = placesRef.current[result.id];
			if (!place) return;

			setInputValue(
				[
					place.placePrediction?.mainText?.text,
					correctedTextRef.current[result.id] ||
						place.placePrediction?.secondaryText?.text,
				]
					.filter(Boolean)
					.join(", "),
			);
			await place.placePrediction
				?.toPlace()
				.fetchFields({
					fields: ["location", "formattedAddress", "addressComponents"],
				})
				.then(({ place }) => {
					return onSelect?.({ selection: parseAddress(place) });
				});

			// Clear cached values now that our selection is complete -- the token is only valid until the first toPlace() call
			setCache({});
			placesRef.current = {};
			correctedTextRef.current = {};
			token.current = null;
		},
		[onSelect],
	);

	const results = useMemo(() => {
		return placesResult.map(
			(suggestion) =>
				({
					mainText: suggestion.placePrediction?.mainText?.text,
					secondaryText:
						correctedTextRef.current[
							suggestion.placePrediction?.placeId || ""
						] || suggestion.placePrediction?.secondaryText?.text,
					id: suggestion.placePrediction?.placeId,
				}) as Result,
		);
	}, [placesResult]);

	return (
		<Autocomplete
			zIndex={zIndex}
			value={inputValue}
			onChange={setInputValue}
			results={results}
			onSelect={handleSelect}
			placeholder={placeholder || "Enter your home address"}
			cta={cta}
			portalRoot={portalRoot}
		/>
	);
}
