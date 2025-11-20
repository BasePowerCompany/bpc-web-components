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
	portalRoot?: ShadowRoot;
};

export function AddressSearch({
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
					}).then(({ suggestions }) => {
						suggestions.forEach((suggestion) => {
							if (!suggestion.placePrediction?.placeId) return;
							placesRef.current[suggestion.placePrediction.placeId] =
								suggestion;
						});
						return suggestions;
					}),
			};
		});
	}, [places, searchQuery]);

	useEffect(() => {
		if (!searchQuery) {
			setPlacesResult([]);
			return;
		}

		const cached = cache[searchQuery];
		if (cached) {
			cached.then((suggestions) => {
				setPlacesResult(suggestions);
			});
		}
	}, [cache, searchQuery]);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const place = placesRef.current[result.id];
			if (!place) return;

			setInputValue(
				[
					place.placePrediction?.mainText?.text,
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
			token.current = null;
		},
		[onSelect],
	);

	const results = useMemo(() => {
		return placesResult.map(
			(suggestion) =>
				({
					mainText: suggestion.placePrediction?.mainText?.text,
					secondaryText: suggestion.placePrediction?.secondaryText?.text,
					id: suggestion.placePrediction?.placeId,
				}) as Result,
		);
	}, [placesResult]);

	return (
		<Autocomplete
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
