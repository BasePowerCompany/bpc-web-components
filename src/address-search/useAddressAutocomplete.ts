"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapsLibrary } from "@/utils/useMapsLibrary";
import type { Result } from "./Autocomplete";

export type ResolvedPlace = {
	/** The fully-fetched Google Place. Parse with `parseAddress` /
	 *  `parseGoogleAddressComponents` at the call site — deferring parse lets
	 *  callers supply a `cityFallback` after other async work completes. */
	place: google.maps.places.Place;
};

export function useAddressAutocomplete(inputValue: string) {
	const places = useMapsLibrary("places");
	const token = useRef<google.maps.places.AutocompleteSessionToken | null>(
		null,
	);
	const placesRef = useRef<
		Record<string, google.maps.places.AutocompleteSuggestion | undefined>
	>({});
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

		if (!token.current) {
			// Keep a single session token across keystrokes so Google can treat
			// one search interaction as one autocomplete session for either flow.
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
					// Shared input: both battery and energy-only ask for the same
					// street-address suggestions, but each flow decides how to use
					// the selected result afterward.
					places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
						input: searchQuery,
						sessionToken: curToken,
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
		if (!cached) return;

		cached.then((suggestions) => {
			setPlacesResult(suggestions);
		});
	}, [cache, searchQuery]);

	const resolveSelection = useCallback(
		async ({
			result,
		}: {
			result: Result;
		}): Promise<ResolvedPlace | undefined> => {
			const suggestion = placesRef.current[result.id];
			if (!suggestion) return undefined;

			const place = suggestion.placePrediction?.toPlace();
			if (!place) return undefined;

			const resolved = await place.fetchFields({
				fields: ["location", "formattedAddress", "addressComponents"],
			});

			// Once a suggestion is resolved to a place, the current autocomplete
			// session is complete and the next edit should start a new one.
			setCache({});
			placesRef.current = {};
			token.current = null;

			return { place: resolved.place };
		},
		[],
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

	return {
		results,
		resolveSelection,
	};
}
