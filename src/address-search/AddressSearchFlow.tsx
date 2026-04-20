import { useCallback, useState } from "react";
import {
	type AddressValidationResult,
	validateAddress,
} from "@/address-search/addressValidation";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import {
	parseAddress,
	parseGoogleAddressComponents,
	posthogCapture,
} from "@/address-search/utils";
import { Autocomplete, type Result } from "./Autocomplete";
import { useAddressAutocomplete } from "./useAddressAutocomplete";

type AddressSearchFlowProps = {
	placeholder: string;
	cta?: string;
	portalRoot: ShadowRoot;
	zIndex: number;
	inputValue: string;
	onInputValueChange: (value: string) => void;
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

/**
 * Shared address entry + resolve + validate flow. Used by both the battery
 * and energy-only variants — the only variant-specific bit is the default
 * placeholder, which the parent supplies.
 */
export function AddressSearchFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	inputValue,
	onInputValueChange,
	onSubmitSelection,
	onRequiresAddressConfirm,
}: AddressSearchFlowProps) {
	const [validating, setValidating] = useState(false);
	const { results, resolveSelection } = useAddressAutocomplete(inputValue);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const fullText = [result.mainText ?? "", result.secondaryText ?? ""]
				.filter(Boolean)
				.join(", ");
			onInputValueChange(fullText);
			setValidating(true);

			let resolved: Awaited<ReturnType<typeof resolveSelection>>;
			let validationResult: AddressValidationResult;
			try {
				[resolved, validationResult] = await Promise.all([
					resolveSelection({ result }),
					validateAddress(fullText),
				]);
			} finally {
				setValidating(false);
			}

			if (!resolved?.place) return;

			// Parse with Validation API's locality as a fallback — Places omits
			// `locality` for CDPs like Cypress, TX, and we don't want to leak
			// a county name into the city field. See utils.ts `resolveCity`.
			const parseOptions = {
				cityFallback: validationResult.validatedLocality,
			};
			const selection = parseAddress(resolved.place, parseOptions);
			const googleAddressComponents = parseGoogleAddressComponents(
				resolved.place,
				parseOptions,
			);

			if (!selection) return;

			if (validationResult.kind !== "accept" && googleAddressComponents) {
				onRequiresAddressConfirm({
					selection,
					googleAddressComponents,
					validationResult,
				});
				return;
			}

			posthogCapture("address_validation_result", {
				kind: validationResult.kind,
				possibleNextAction: validationResult.possibleNextAction,
				dpvConfirmation: validationResult.dpvConfirmation,
				dpvFootnote: validationResult.dpvFootnote,
				inputFormattedAddress: fullText,
				googleFormattedAddress: validationResult.googleFormattedAddress,
				confirmation_path: "silent",
			});
			onSubmitSelection({ selection, confirmAddress: true });
		},
		[
			onInputValueChange,
			onRequiresAddressConfirm,
			onSubmitSelection,
			resolveSelection,
		],
	);

	const handleInputChange = useCallback(
		(value: string) => {
			onInputValueChange(value);
		},
		[onInputValueChange],
	);

	return (
		<Autocomplete
			zIndex={zIndex}
			value={inputValue}
			onChange={handleInputChange}
			results={results}
			onSelect={handleSelect}
			placeholder={placeholder}
			cta={cta}
			portalRoot={portalRoot}
			loading={validating}
		/>
	);
}
