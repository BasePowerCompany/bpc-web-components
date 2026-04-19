import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	AddressValidationResult,
	UnconfirmedFieldType,
} from "@/address-search/addressValidation";
import { CloseIcon } from "@/address-search/icons/CloseIcon";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { cx } from "@/utils/cx";
import { copyFor } from "./AddressConfirmModal.copy";
import { ConfirmField } from "./ConfirmField";
import styles from "./styles.module.css";

export type AddressConfirmModalProps = {
	selection: AddressResult;
	googleAddressComponents: ParsedGoogleAddressComponents;
	validationResult: AddressValidationResult;
	loading: boolean;
	onContinue: (result: AddressResult) => void;
	onClose: () => void;
};

function useFieldHighlight(
	validationResult: AddressValidationResult,
): (field: UnconfirmedFieldType) => boolean {
	return useMemo(() => {
		const set = new Set(validationResult.unconfirmedFields);
		return (field: UnconfirmedFieldType) => set.has(field);
	}, [validationResult.unconfirmedFields]);
}

type FormValues = {
	line1: string;
	line2: string;
	city: string;
	state: string;
	postalCode: string;
};

/**
 * Names of the form fields the user actually changed. Compare against the
 * field's initial value at modal mount — NOT against `googleAddressComponents`
 * directly, because the form pre-fills with a fallback (selection.address.X)
 * when Google's component is empty. line2 is skipped when the user chose the
 * single-family-home escape (their unit input is intentionally discarded).
 */
function diffFields(
	current: FormValues,
	initial: FormValues,
	opts: { omitLine2: boolean },
): UnconfirmedFieldType[] {
	const edited: UnconfirmedFieldType[] = [];
	if (current.line1.trim() !== initial.line1) edited.push("line1");
	if (!opts.omitLine2 && current.line2.trim() !== initial.line2)
		edited.push("line2");
	if (current.city.trim() !== initial.city) edited.push("city");
	if (current.state.trim() !== initial.state) edited.push("state");
	if (current.postalCode.trim() !== initial.postalCode)
		edited.push("postalCode");
	return edited;
}

export function AddressConfirmModal({
	selection,
	googleAddressComponents,
	validationResult,
	loading,
	onContinue,
	onClose,
}: AddressConfirmModalProps) {
	const { kind } = validationResult;
	const copy = useMemo(
		() => copyFor(kind, validationResult.unconfirmedComponentTypes),
		[kind, validationResult.unconfirmedComponentTypes],
	);
	const isFieldHighlighted = useFieldHighlight(validationResult);
	const [line1, setLine1] = useState(
		googleAddressComponents.line1 || selection.address.line1,
	);
	const [line2, setLine2] = useState(googleAddressComponents.line2 || "");
	const [city, setCity] = useState(
		googleAddressComponents.city || selection.address.city,
	);
	const [state, setState] = useState(
		googleAddressComponents.state || selection.address.state,
	);
	const [postalCode, setPostalCode] = useState(
		googleAddressComponents.postalCode || selection.address.postalCode,
	);

	// Snapshot of initial form values used for edit detection. Uses the same
	// fallback chain as the useState initializers above so diffFields doesn't
	// flag a "edited" when the user actually confirmed as-is.
	const initialFormValuesRef = useRef<FormValues>({
		line1,
		line2,
		city,
		state,
		postalCode,
	});

	const line2Ref = useRef<HTMLInputElement>(null);
	const line1Ref = useRef<HTMLInputElement>(null);
	const line2WarningId = useId();

	const line2IsRequired = kind === "missing_subpremise";
	const line2Missing = line2IsRequired && !line2.trim();

	// Track whether we've already captured the "shown" event for this modal
	// mount so it fires once per validation, not every re-render.
	const hasLoggedShown = useRef(false);
	useEffect(() => {
		if (hasLoggedShown.current) return;
		hasLoggedShown.current = true;
		posthogCapture("address_validation_result", {
			kind: validationResult.kind,
			possibleNextAction: validationResult.possibleNextAction,
			unconfirmedComponentTypes: validationResult.unconfirmedComponentTypes,
			missingComponentTypes: validationResult.missingComponentTypes,
			hasUnconfirmedComponents: validationResult.hasUnconfirmedComponents,
			hasInferredComponents: validationResult.hasInferredComponents,
			hasReplacedComponents: validationResult.hasReplacedComponents,
			dpvConfirmation: validationResult.dpvConfirmation,
			dpvFootnote: validationResult.dpvFootnote,
			inputFormattedAddress: selection.formattedAddress,
			googleFormattedAddress: validationResult.googleFormattedAddress,
			confirmation_path: "modal",
		});
	}, [validationResult, selection.formattedAddress]);

	// Focus the most useful field on mount based on the kind:
	// - subpremise cases → line_2
	// - street_number / component cases → line_1
	useEffect(() => {
		const target =
			kind === "missing_subpremise" || kind === "confirm_subpremise"
				? line2Ref.current
				: line1Ref.current;
		requestAnimationFrame(() => {
			target?.focus();
			target?.select?.();
		});
	}, [kind]);

	const buildResult = useCallback(
		(opts: { omitLine2: boolean }): AddressResult => {
			const effectiveLine2 = opts.omitLine2 ? "" : line2.trim();
			const normalizedLine1 = [line1.trim(), effectiveLine2]
				.filter(Boolean)
				.join(" ");
			const formattedAddress = [
				normalizedLine1,
				city.trim(),
				[state.trim(), postalCode.trim()].filter(Boolean).join(" "),
				selection.address.country,
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
					country: selection.address.country,
					latitude: selection.address.latitude,
					longitude: selection.address.longitude,
				},
			};
		},
		[
			city,
			line1,
			line2,
			postalCode,
			selection.address.country,
			selection.address.latitude,
			selection.address.longitude,
			state,
		],
	);

	const submit = useCallback(
		(userAction: "confirmed_as_is" | "confirmed_sfh" | "edited") => {
			const omitLine2 = userAction === "confirmed_sfh";
			const result = buildResult({ omitLine2 });
			const editedFields = diffFields(
				{ line1, line2, city, state, postalCode },
				initialFormValuesRef.current,
				{ omitLine2 },
			);
			posthogCapture("address_validation_override", {
				kind: validationResult.kind,
				user_action: userAction,
				inputFormattedAddress: selection.formattedAddress,
				submittedFormattedAddress: result.formattedAddress,
				editedFields,
			});
			onContinue(result);
		},
		[
			buildResult,
			city,
			line1,
			line2,
			onContinue,
			postalCode,
			selection.formattedAddress,
			state,
			validationResult.kind,
		],
	);

	const handleContinue = useCallback(() => {
		if (line2Missing) {
			requestAnimationFrame(() => line2Ref.current?.focus());
			return;
		}
		const edited =
			diffFields(
				{ line1, line2, city, state, postalCode },
				initialFormValuesRef.current,
				{ omitLine2: false },
			).length > 0;
		submit(edited ? "edited" : "confirmed_as_is");
	}, [city, line1, line2, line2Missing, postalCode, state, submit]);

	const handleSingleFamilyHome = useCallback(() => {
		submit("confirmed_sfh");
	}, [submit]);

	const handleClose = useCallback(() => {
		posthogCapture("address_validation_dismiss", {
			kind: validationResult.kind,
			inputFormattedAddress: selection.formattedAddress,
		});
		onClose();
	}, [onClose, selection.formattedAddress, validationResult.kind]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click-to-dismiss is a standard modal pattern
		<div
			className={styles.addressConfirmBackdrop}
			onClick={(e) => {
				if (e.target === e.currentTarget) handleClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") handleClose();
			}}
		>
			<div
				className={styles.addressConfirmCard}
				role="dialog"
				aria-modal="true"
			>
				<button
					type="button"
					className={styles.addressConfirmCloseIcon}
					onClick={handleClose}
					aria-label="Close"
				>
					<CloseIcon />
				</button>

				<h2 className={styles.addressConfirmTitle}>{copy.title}</h2>

				{copy.banner && (
					<div
						className={cx(
							styles.addressConfirmBanner,
							copy.banner.tone === "error"
								? styles.addressConfirmBannerError
								: styles.addressConfirmBannerWarn,
						)}
						role={copy.banner.tone === "error" ? "alert" : "status"}
					>
						{copy.banner.text}
					</div>
				)}

				<div className={styles.addressConfirmForm}>
					<ConfirmField
						ref={line1Ref}
						value={line1}
						onChange={setLine1}
						placeholder="Street address"
						highlighted={isFieldHighlighted("line1")}
					/>
					<ConfirmField
						ref={line2Ref}
						value={line2}
						onChange={setLine2}
						placeholder={copy.line2Placeholder}
						highlighted={isFieldHighlighted("line2")}
						error={line2Missing}
						errorText={`Please enter your unit number, or choose \u201Csingle-family home\u201D below`}
						errorId={line2WarningId}
					/>
					<div className={styles.addressConfirmGrid}>
						<ConfirmField
							value={city}
							onChange={setCity}
							placeholder="City"
							highlighted={isFieldHighlighted("city")}
						/>
						<ConfirmField
							value={state}
							onChange={setState}
							placeholder="State"
							highlighted={isFieldHighlighted("state")}
						/>
						<ConfirmField
							value={postalCode}
							onChange={setPostalCode}
							placeholder="ZIP"
							highlighted={isFieldHighlighted("postalCode")}
						/>
					</div>

					<div className={styles.addressConfirmActions}>
						<button
							type="button"
							className={styles.addressConfirmContinueButton}
							onClick={handleContinue}
							disabled={loading}
						>
							{loading ? (
								<span className={styles.addressConfirmSpinner} />
							) : (
								copy.continueLabel
							)}
						</button>
						{copy.secondaryAction && (
							<button
								type="button"
								className={styles.addressConfirmSecondaryButton}
								onClick={handleSingleFamilyHome}
								disabled={loading}
							>
								{copy.secondaryAction.label}
							</button>
						)}
						<button
							type="button"
							className={styles.addressConfirmCloseButton}
							onClick={handleClose}
							disabled={loading}
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
