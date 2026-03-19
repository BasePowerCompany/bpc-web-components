import { useCallback, useRef, useState } from "react";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import { cx } from "@/utils/cx";
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
	const [expandedLine1, setExpandedLine1] = useState("");
	const [line2, setLine2] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [postalCode, setPostalCode] = useState("");
	const [isUnitExpanded, setIsUnitExpanded] = useState(false);
	const [googleAddressComponents, setGoogleAddressComponents] = useState<
		ParsedGoogleAddressComponents | undefined
	>();
	const [selectedSelection, setSelectedSelection] = useState<
		AddressResult | undefined
	>();
	// Share the actual Autocomplete input element so Continue can focus line_1
	// when energy-only has not selected a suggestion yet.
	const line1Ref = useRef<HTMLInputElement>(null);
	const line2Ref = useRef<HTMLInputElement>(null);
	const { results, resolveSelection } = useAddressAutocomplete(line1);

	const focusLine2 = useCallback(() => {
		requestAnimationFrame(() => {
			line2Ref.current?.focus();
		});
	}, []);

	const populateExpandedFields = useCallback(
		({
			selection,
			googleComponents,
			focusLine2Field = false,
		}: {
			selection?: AddressResult;
			googleComponents?: ParsedGoogleAddressComponents;
			focusLine2Field?: boolean;
		}) => {
			const nextExpandedLine1 =
				googleComponents?.line1 || selection?.address.line1 || line1;
			setExpandedLine1(nextExpandedLine1);
			setLine1(nextExpandedLine1);
			setLine2(googleComponents?.line2 || "");
			setCity(googleComponents?.city || selection?.address.city || "");
			setState(googleComponents?.state || selection?.address.state || "");
			setPostalCode(
				googleComponents?.postalCode || selection?.address.postalCode || "",
			);

			if (focusLine2Field) {
				focusLine2();
			}
		},
		[focusLine2, line1],
	);

	const buildCollapsedAddressDisplay = useCallback(
		({
			line1Value,
			line2Value,
			cityValue,
			stateValue,
			postalCodeValue,
		}: {
			line1Value: string;
			line2Value: string;
			cityValue: string;
			stateValue: string;
			postalCodeValue: string;
		}) => {
			const addressLine = [line1Value.trim(), line2Value.trim()]
				.filter(Boolean)
				.join(" ");
			const localityLine = [
				cityValue.trim(),
				[stateValue.trim(), postalCodeValue.trim()].filter(Boolean).join(" "),
			]
				.filter(Boolean)
				.join(", ");

			return [addressLine, localityLine].filter(Boolean).join(", ");
		},
		[],
	);

	const handleInputChange = useCallback((value: string) => {
		setLine1(value);
		setExpandedLine1(value);
		setLine2("");
		setGoogleAddressComponents(undefined);
		setSelectedSelection(undefined);
		setCity("");
		setState("");
		setPostalCode("");
	}, []);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const resolved = await resolveSelection({ result });
			if (!resolved?.selection) return;

			setSelectedSelection(resolved.selection);
			setGoogleAddressComponents(resolved.googleAddressComponents);
			setExpandedLine1(
				resolved.googleAddressComponents?.line1 ||
					resolved.selection.address.line1,
			);
			setLine2(resolved.googleAddressComponents?.line2 || "");
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

			if (isUnitExpanded) {
				populateExpandedFields({
					selection: resolved.selection,
					googleComponents: resolved.googleAddressComponents,
					focusLine2Field: true,
				});
				return;
			}

			setLine1(
				[result.mainText ?? "", result.secondaryText ?? ""]
					.filter(Boolean)
					.join(", "),
			);
		},
		[isUnitExpanded, populateExpandedFields, resolveSelection],
	);

	const handleApartmentToggle = useCallback(() => {
		if (isUnitExpanded) {
			setIsUnitExpanded(false);
			setLine1(
				buildCollapsedAddressDisplay({
					line1Value: expandedLine1,
					line2Value: line2,
					cityValue: city,
					stateValue: state,
					postalCodeValue: postalCode,
				}) || line1.trim(),
			);
			return;
		}

		setIsUnitExpanded(true);
		populateExpandedFields({
			selection: selectedSelection,
			googleComponents: googleAddressComponents,
			focusLine2Field: Boolean(selectedSelection),
		});
	}, [
		buildCollapsedAddressDisplay,
		city,
		expandedLine1,
		googleAddressComponents,
		isUnitExpanded,
		line1,
		line2,
		populateExpandedFields,
		postalCode,
		selectedSelection,
		state,
	]);

	const handleContinue = useCallback(() => {
		if (!selectedSelection) {
			line1Ref.current?.focus();
			return;
		}

		if (!isUnitExpanded) {
			onSubmitSelection({
				selection: selectedSelection,
				confirmAddress: true,
			});
			return;
		}

		const line1Value = [expandedLine1.trim(), line2.trim()]
			.filter(Boolean)
			.join(" ");
		const formattedAddress = [
			line1Value,
			city.trim(),
			[state.trim(), postalCode.trim()].filter(Boolean).join(" "),
			selectedSelection.address.country,
		]
			.filter(Boolean)
			.join(", ");
		const selection = {
			formattedAddress,
			address: {
				line1: line1Value,
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
		expandedLine1,
		isUnitExpanded,
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
			<button
				type="button"
				className={cx(
					styles.energyOnlyDisclosureButton,
					isUnitExpanded && styles.energyOnlyDisclosureButtonExpanded,
				)}
				onClick={handleApartmentToggle}
				aria-expanded={isUnitExpanded}
			>
				<span className={styles.energyOnlyDisclosureIcon} aria-hidden="true">
					{isUnitExpanded ? "-" : "+"}
				</span>
				<span>
					{isUnitExpanded
						? "Hide apartment or unit number"
						: "Add apartment or unit number"}
				</span>
			</button>
			{isUnitExpanded && (
				<div className={styles.energyOnlyExpandedFields}>
					<input
						ref={line2Ref}
						type="text"
						value={line2}
						onChange={(event) => setLine2(event.target.value)}
						placeholder="Apartment or unit number"
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
				</div>
			)}
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
