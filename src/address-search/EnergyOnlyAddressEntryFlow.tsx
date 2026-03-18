import { useCallback, useRef, useState } from "react";
import type { AddressResult } from "@/address-search/types";
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
};

export function EnergyOnlyAddressEntryFlow({
	placeholder,
	cta,
	portalRoot,
	zIndex,
	onSubmitSelection,
}: EnergyOnlyAddressEntryFlowProps) {
	const [line1, setLine1] = useState("");
	const [line2, setLine2] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [postalCode, setPostalCode] = useState("");
	const [selectedSelection, setSelectedSelection] = useState<
		AddressResult | undefined
	>();
	// Share the actual Autocomplete input element so Continue can focus line_1
	// when energy-only has not selected a suggestion yet.
	const line1Ref = useRef<HTMLInputElement>(null);
	const line2Ref = useRef<HTMLInputElement>(null);
	const { results, resolveSelection } = useAddressAutocomplete(line1);

	const handleInputChange = useCallback((value: string) => {
		setLine1(value);
		setSelectedSelection(undefined);
	}, []);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const resolved = await resolveSelection({ result });
			if (!resolved?.selection) return;

			setSelectedSelection(resolved.selection);
			setLine1(
				resolved.googleAddressComponents?.line1 ||
					resolved.selection.address.line1,
			);
			setLine2(
				(currentLine2) =>
					resolved.googleAddressComponents?.line2 || currentLine2,
			);
			setCity(
				resolved.googleAddressComponents?.city ||
					resolved.selection.address.city ||
					"",
			);
			setState(
				resolved.googleAddressComponents?.state ||
					resolved.selection.address.state ||
					"",
			);
			setPostalCode(
				resolved.googleAddressComponents?.postalCode ||
					resolved.selection.address.postalCode ||
					"",
			);
			// focus on line2 after selection
			// so user can decide if they want to add line2 and focus away from the autocomplete dropdown
			requestAnimationFrame(() => {
				line2Ref.current?.focus();
			});
		},
		[resolveSelection],
	);

	const handleContinue = useCallback(() => {
		if (!selectedSelection) {
			line1Ref.current?.focus();
			return;
		}

		// format the address payload, combining line1, line2, city, state, and postal code
		// format like "300 East Riverside Drive unit 345, Austin, TX 78704, US"
		const formattedAddress = [
			[line1.trim(), line2.trim()].filter(Boolean).join(" "),
			city.trim(),
			[state.trim(), postalCode.trim()].filter(Boolean).join(" "),
			selectedSelection.address.country,
		]
			.filter(Boolean)
			.join(", ");
		const selection = {
			formattedAddress,
			address: {
				line1: [line1.trim(), line2.trim()].filter(Boolean).join(" "),
				city: city.trim(),
				state: state.trim(),
				postalCode: postalCode.trim(),
				country: selectedSelection.address.country,
				latitude: selectedSelection.address.latitude,
				longitude: selectedSelection.address.longitude,
			},
		};

		onSubmitSelection({
			selection,
			confirmAddress: true,
		});
	}, [
		city,
		line1,
		line2,
		onSubmitSelection,
		postalCode,
		selectedSelection,
		state,
	]);

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
			<input
				ref={line2Ref}
				type="text"
				value={line2}
				onChange={(event) => setLine2(event.target.value)}
				placeholder="Apt, Suite, Unit (optional)"
				autoComplete="address-line2"
				className={styles.energyFormInput}
			/>
			<div className={styles.energyOnlyGrid}>
				<input
					type="text"
					value={city}
					onChange={(event) => setCity(event.target.value)}
					placeholder="City"
					autoComplete="address-level2"
					className={styles.energyFormInput}
				/>
				<input
					type="text"
					value={state}
					onChange={(event) => setState(event.target.value)}
					placeholder="State"
					autoComplete="address-level1"
					className={styles.energyFormInput}
				/>
				<input
					type="text"
					value={postalCode}
					onChange={(event) => setPostalCode(event.target.value)}
					placeholder="ZIP"
					autoComplete="postal-code"
					className={styles.energyFormInput}
				/>
			</div>
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
