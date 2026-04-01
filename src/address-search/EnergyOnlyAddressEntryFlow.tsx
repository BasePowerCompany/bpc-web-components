import { useCallback, useEffect, useId, useRef, useState } from "react";
import { validateAddress } from "@/address-search/addressValidation";
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
	const [requiresSubpremise, setRequiresSubpremise] = useState(false);
	const [line2Error, setLine2Error] = useState(false);
	const line2ErrorId = useId();
	// Share the actual Autocomplete input element so Continue can focus line_1
	// when energy-only has not selected a suggestion yet.
	const line1Ref = useRef<HTMLInputElement>(null);
	const line2Ref = useRef<HTMLInputElement>(null);
	const isUnitExpandedRef = useRef(isUnitExpanded);
	const { results, resolveSelection } = useAddressAutocomplete(line1);

	useEffect(() => {
		isUnitExpandedRef.current = isUnitExpanded;
	}, [isUnitExpanded]);

	const focusLine2 = useCallback(() => {
		requestAnimationFrame(() => {
			line2Ref.current?.focus();
		});
	}, []);

	// populate the expanded fields with the google components or selection (defensive about what data google returns)
	const populateExpandedFields = useCallback(
		({
			selection,
			googleComponents,
		}: {
			selection?: AddressResult;
			googleComponents?: ParsedGoogleAddressComponents;
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
		},
		[line1],
	);

	const handleInputChange = useCallback((value: string) => {
		setLine1(value);
		setSelectedSelection(undefined);
		setExpandedLine1(value);
		setLine2("");
		setGoogleAddressComponents(undefined);
		setCity("");
		setState("");
		setPostalCode("");
		setRequiresSubpremise(false);
		setLine2Error(false);
	}, []);

	const handleSelect = useCallback(
		async ({ result }: { result: Result }) => {
			const fullText = [result.mainText ?? "", result.secondaryText ?? ""]
				.filter(Boolean)
				.join(", ");
			setLine1(fullText);
			setRequiresSubpremise(false);
			setLine2Error(false);

			// validate address + fetch all the details in parallel
			const [resolved, validationResult] = await Promise.all([
				resolveSelection({ result }),
				validateAddress(fullText),
			]);

			if (!resolved?.selection) return;
			setSelectedSelection(resolved.selection);
			setGoogleAddressComponents(resolved.googleAddressComponents);

			// handle apartment / multi-unit address validation
			const needsSubpremise = validationResult.requiresSubpremise;
			setRequiresSubpremise(needsSubpremise);

			if (needsSubpremise && !isUnitExpandedRef.current) {
				setIsUnitExpanded(true);
				populateExpandedFields({
					selection: resolved.selection,
					googleComponents: resolved.googleAddressComponents,
				});
				focusLine2();
				return;
			}

			if (isUnitExpandedRef.current) {
				populateExpandedFields({
					selection: resolved.selection,
					googleComponents: resolved.googleAddressComponents,
				});
				focusLine2();
				return;
			}
		},
		[focusLine2, populateExpandedFields, resolveSelection],
	);

	const buildSelectionFromExpandedFields = useCallback(() => {
		if (!selectedSelection) return undefined;

		const normalizedLine1 = [expandedLine1.trim(), line2.trim()]
			.filter(Boolean)
			.join(" ");
		const formattedAddress = [
			normalizedLine1,
			city.trim(),
			[state.trim(), postalCode.trim()].filter(Boolean).join(" "),
			selectedSelection.address.country,
		]
			.filter(Boolean)
			.join(", ");

		return {
			formattedAddress,
			address: {
				line1: normalizedLine1,
				city: city.trim(),
				state: state.trim(),
				postalCode: postalCode.trim(),
				country: selectedSelection.address.country,
				latitude: selectedSelection.address.latitude,
				longitude: selectedSelection.address.longitude,
			},
		} satisfies AddressResult;
	}, [city, expandedLine1, line2, postalCode, selectedSelection, state]);

	const buildGoogleAddressComponentsFromExpandedFields = useCallback(() => {
		if (!selectedSelection) return undefined;

		return {
			line1: expandedLine1.trim(),
			line2: line2.trim(),
			city: city.trim(),
			state: state.trim(),
			postalCode: postalCode.trim(),
			country: selectedSelection.address.country,
			latitude: selectedSelection.address.latitude,
			longitude: selectedSelection.address.longitude,
		} satisfies ParsedGoogleAddressComponents;
	}, [city, expandedLine1, line2, postalCode, selectedSelection, state]);

	const buildLine1ValueFromExpandedFields = useCallback(() => {
		const addressLine = [expandedLine1.trim(), line2.trim()]
			.filter(Boolean)
			.join(" ");
		const localityLine = [
			city.trim(),
			[state.trim(), postalCode.trim()].filter(Boolean).join(" "),
		]
			.filter(Boolean)
			.join(", ");
		const collapsedLine1 = [addressLine, localityLine]
			.filter(Boolean)
			.join(", ");
		return collapsedLine1;
	}, [expandedLine1, line2, city, state, postalCode]);

	const handleApartmentToggle = useCallback(() => {
		if (isUnitExpanded) {
			if (requiresSubpremise && !line2.trim()) {
				setLine2Error(true);
				focusLine2();
				return;
			}
			const updatedSelection = buildSelectionFromExpandedFields();
			const updatedGoogleAddressComponents =
				buildGoogleAddressComponentsFromExpandedFields();
			setIsUnitExpanded(false);
			setLine1(buildLine1ValueFromExpandedFields() || line1.trim());
			if (updatedSelection) {
				setSelectedSelection(updatedSelection);
			}
			if (updatedGoogleAddressComponents) {
				setGoogleAddressComponents(updatedGoogleAddressComponents);
			}
			return;
		}

		setIsUnitExpanded(true);
		populateExpandedFields({
			selection: selectedSelection,
			googleComponents: googleAddressComponents,
		});
	}, [
		line1,
		line2,
		focusLine2,
		googleAddressComponents,
		isUnitExpanded,
		requiresSubpremise,
		buildGoogleAddressComponentsFromExpandedFields,
		buildSelectionFromExpandedFields,
		populateExpandedFields,
		selectedSelection,
		buildLine1ValueFromExpandedFields,
	]);

	const handleContinue = useCallback(() => {
		if (!selectedSelection) {
			line1Ref.current?.focus();
			return;
		}

		if (requiresSubpremise && !line2.trim()) {
			if (!isUnitExpanded) {
				setIsUnitExpanded(true);
				populateExpandedFields({
					selection: selectedSelection,
					googleComponents: googleAddressComponents,
				});
			}
			setLine2Error(true);
			focusLine2();
			return;
		}

		setLine2Error(false);

		if (!isUnitExpanded) {
			onSubmitSelection({
				selection: selectedSelection,
				confirmAddress: true,
			});
			return;
		}

		const selection = buildSelectionFromExpandedFields();
		if (!selection) return;

		onSubmitSelection({
			selection,
			confirmAddress: true,
		});
	}, [
		buildSelectionFromExpandedFields,
		focusLine2,
		googleAddressComponents,
		isUnitExpanded,
		line2,
		onSubmitSelection,
		populateExpandedFields,
		requiresSubpremise,
		selectedSelection,
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
						onChange={(event) => {
							setLine2(event.target.value);
							if (line2Error) setLine2Error(false);
						}}
						placeholder="Apartment or unit number"
						autoComplete="address-line2"
						className={cx(
							styles.energyFormInput,
							line2Error && styles.energyFormInputError,
						)}
						aria-invalid={line2Error}
						aria-describedby={line2Error ? line2ErrorId : undefined}
					/>
					{line2Error && (
						<span id={line2ErrorId} className={styles.energyFormInputErrorText}>
							Please enter your apartment or unit number
						</span>
					)}
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
