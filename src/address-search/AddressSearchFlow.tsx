import { useCallback, useRef, useState } from "react";
import {
	type AddressValidationResult,
	validateAddress,
} from "@/address-search/addressValidation";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
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

			// resolveSelection clears its cache after resolving, so re-selecting
			// the same suggestion returns undefined. Fall back to stored data.
			if (!resolved?.selection) {
				if (lastConfirmDataRef.current) {
					onRequiresAddressConfirm(lastConfirmDataRef.current);
				}
				return;
			}

			// Places Autocomplete omits `locality` for CDPs like Cypress, TX.
			// Backfill city from the Validation API (which correctly returns it)
			// so users don't see an empty or county-derived city.
			if (
				!resolved.selection.address.city &&
				validationResult.validatedLocality
			) {
				resolved.selection.address.city = validationResult.validatedLocality;
			}
			if (
				resolved.googleAddressComponents &&
				!resolved.googleAddressComponents.city &&
				validationResult.validatedLocality
			) {
				resolved.googleAddressComponents.city =
					validationResult.validatedLocality;
			}

			if (
				validationResult.kind !== "accept" &&
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
			posthogCapture("address_validation_result", {
				kind: validationResult.kind,
				possibleNextAction: validationResult.possibleNextAction,
				dpvConfirmation: validationResult.dpvConfirmation,
				dpvFootnote: validationResult.dpvFootnote,
				inputFormattedAddress: fullText,
				googleFormattedAddress: validationResult.googleFormattedAddress,
				confirmation_path: "silent",
			});
			onSubmitSelection({
				selection: resolved.selection,
				confirmAddress: true,
			});
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
