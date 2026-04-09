import { useCallback, useRef, useState } from "react";
import {
	type AddressValidationResult,
	validateAddress,
} from "@/address-search/addressValidation";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import { Autocomplete, type Result } from "./Autocomplete";
import { useAddressAutocomplete } from "./useAddressAutocomplete";

type EnergyOnlyAddressEntryFlowProps = {
	placeholder?: string;
	cta?: string;
	portalRoot: ShadowRoot;
	zIndex: number;
	onSubmitSelection: (detail: {
		selection: AddressResult | undefined;
		confirmAddress: boolean;
	}) => void;
	onRequiresAddressConfirm: (data: {
		selection: AddressResult;
		googleAddressComponents: ParsedGoogleAddressComponents;
		validationResult: AddressValidationResult;
	}) => void;
};

export function EnergyOnlyAddressEntryFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	onSubmitSelection,
	onRequiresAddressConfirm,
}: EnergyOnlyAddressEntryFlowProps) {
	const [inputValue, setInputValue] = useState("");
	// Stores the last address confirmation data to power the address confirmation modal.
	// resolveSelection clears its internal cache after each resolve,
	// so subsequent selects of the same item return
	// undefined — this ref lets us fall back to the previously resolved data.
	const lastConfirmDataRef = useRef<{
		selection: AddressResult;
		googleAddressComponents: ParsedGoogleAddressComponents;
		validationResult: AddressValidationResult;
	} | null>(null);
	const { results, resolveSelection } = useAddressAutocomplete(inputValue);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const fullText = [result.mainText ?? "", result.secondaryText ?? ""]
				.filter(Boolean)
				.join(", ");
			setInputValue(fullText);

			const [resolved, validationResult] = await Promise.all([
				resolveSelection({ result }),
				validateAddress(fullText),
			]);

			// resolveSelection clears its cache after resolving, so re-selecting
			// the same suggestion returns undefined. Fall back to stored data.
			if (!resolved?.selection) {
				if (lastConfirmDataRef.current) {
					onRequiresAddressConfirm(lastConfirmDataRef.current);
				}
				return;
			}

			if (
				validationResult.requiresSubpremise &&
				resolved.googleAddressComponents
			) {
				const confirmData = {
					selection: resolved.selection,
					googleAddressComponents: resolved.googleAddressComponents,
					validationResult,
				};
				lastConfirmDataRef.current = confirmData;
				onRequiresAddressConfirm(confirmData);
				return;
			}

			lastConfirmDataRef.current = null;
			onSubmitSelection({
				selection: resolved.selection,
				confirmAddress: true,
			});
		},
		[onRequiresAddressConfirm, onSubmitSelection, resolveSelection],
	);

	const handleInputChange = useCallback((value: string) => {
		setInputValue(value);
	}, []);

	return (
		<Autocomplete
			zIndex={zIndex}
			value={inputValue}
			onChange={handleInputChange}
			results={results}
			onSelect={handleSelect}
			placeholder={placeholder || "Street address"}
			cta={cta}
			portalRoot={portalRoot}
		/>
	);
}
