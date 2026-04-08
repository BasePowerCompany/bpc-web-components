import { useCallback, useRef, useState } from "react";
import {
	type AddressValidationResult,
	validateAddress,
} from "@/address-search/addressValidation";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import {
	mergeValidatedGoogleComponents,
	mergeValidatedSelection,
} from "@/address-search/utils";
import { Autocomplete, type Result } from "./Autocomplete";
import styles from "./styles.module.css";
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
	const [line1, setLine1] = useState("");
	const [selectedSelection, setSelectedSelection] = useState<
		AddressResult | undefined
	>();
	// Stores the last address confirmation data to power the address confirmation modal.
	// resolveSelection clears its internal cache after each resolve,
	// so subsequent selects of the same item return
	// undefined — this ref lets us fall back to the previously resolved data.
	const lastConfirmDataRef = useRef<{
		selection: AddressResult;
		googleAddressComponents: ParsedGoogleAddressComponents;
		validationResult: AddressValidationResult;
	} | null>(null);
	const line1Ref = useRef<HTMLInputElement>(null);
	const { results, resolveSelection } = useAddressAutocomplete(line1);

	const handleInputChange = useCallback((value: string) => {
		setLine1(value);
		setSelectedSelection(undefined);
	}, []);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const fullText = [result.mainText ?? "", result.secondaryText ?? ""]
				.filter(Boolean)
				.join(", ");
			setLine1(fullText);

			// validate address + fetch all the details in parallel
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

			// Treat the Address Validation API response as canonical whenever it
			// returned a postalAddress. This keeps the frontend consistent with
			// the backend, which runs its own USPS-backed validation pass.
			let finalSelection = resolved.selection;
			let finalGoogleComponents = resolved.googleAddressComponents;
			if (validationResult.validatedAddress) {
				finalSelection = mergeValidatedSelection(
					resolved.selection,
					validationResult.validatedAddress,
				);
				if (finalGoogleComponents) {
					finalGoogleComponents = mergeValidatedGoogleComponents(
						finalGoogleComponents,
						validationResult.validatedAddress,
					);
				}
			}

			// Reflect the canonicalized address in the visible input so that what
			// the user sees matches what will be submitted.
			setLine1(finalSelection.formattedAddress);
			setSelectedSelection(finalSelection);

			// If address needs apartment/unit number, delegate to modal via parent
			if (validationResult.requiresSubpremise && finalGoogleComponents) {
				const confirmData = {
					selection: finalSelection,
					googleAddressComponents: finalGoogleComponents,
					validationResult,
				};
				lastConfirmDataRef.current = confirmData;
				onRequiresAddressConfirm(confirmData);
				return;
			}

			lastConfirmDataRef.current = null;
		},
		[onRequiresAddressConfirm, resolveSelection],
	);

	const handleContinue = useCallback(() => {
		if (!selectedSelection) {
			line1Ref.current?.focus();
			return;
		}

		// Re-open modal if the address still requires confirmation
		if (lastConfirmDataRef.current) {
			onRequiresAddressConfirm(lastConfirmDataRef.current);
			return;
		}

		onSubmitSelection({
			selection: selectedSelection,
			confirmAddress: true,
		});
	}, [onRequiresAddressConfirm, onSubmitSelection, selectedSelection]);

	return (
		<div className={styles.energyOnlyForm}>
			<Autocomplete
				zIndex={zIndex}
				inputRef={line1Ref}
				value={line1}
				onChange={handleInputChange}
				results={results}
				onSelect={handleSelect}
				placeholder={placeholder || "Street address"}
				cta={cta}
				showCtaButton={false}
				portalRoot={portalRoot}
			/>
			<button
				type="button"
				className={styles.energyOnlyContinueButton}
				onClick={handleContinue}
			>
				{cta || "Continue"}
			</button>
		</div>
	);
}
