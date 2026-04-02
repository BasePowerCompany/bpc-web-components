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

			setSelectedSelection(resolved.selection);

			// If address needs apartment/unit number, delegate to modal via parent
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
