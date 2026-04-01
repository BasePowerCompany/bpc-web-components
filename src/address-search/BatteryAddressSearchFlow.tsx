import { useCallback, useState } from "react";
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

type BatteryAddressSearchFlowProps = {
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

export function BatteryAddressSearchFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	onSubmitSelection,
	onRequiresAddressConfirm,
}: BatteryAddressSearchFlowProps) {
	const [inputValue, setInputValue] = useState("");
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

			if (!resolved?.selection) return;

			if (
				validationResult.requiresSubpremise &&
				resolved.googleAddressComponents
			) {
				onRequiresAddressConfirm({
					selection: resolved.selection,
					googleAddressComponents: resolved.googleAddressComponents,
					validationResult,
				});
				return;
			}

			onSubmitSelection({
				selection: resolved.selection,
				confirmAddress: true,
			});
		},
		[onRequiresAddressConfirm, onSubmitSelection, resolveSelection],
	);

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
