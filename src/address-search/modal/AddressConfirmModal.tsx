import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	AddressValidationKind,
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
import styles from "./styles.module.css";

export type AddressConfirmModalProps = {
	selection: AddressResult;
	googleAddressComponents: ParsedGoogleAddressComponents;
	validationResult: AddressValidationResult;
	loading: boolean;
	onContinue: (result: AddressResult) => void;
	onClose: () => void;
};

type Copy = {
	title: string;
	/** Optional banner shown above the form. */
	banner?: {
		/** visual severity — drives color */
		tone: "warn" | "error";
		/** short one-liner */
		text: string;
	};
	line2Placeholder: string;
	continueLabel: string;
	/** Secondary CTA (e.g. "This is a single-family home") */
	secondaryAction?: {
		label: string;
		/** If true, submitting this action clears line_2. */
		clearsLine2: boolean;
	};
};

/**
 * Maps Google component types to user-facing labels used in the
 * confirm_components banner. Order matters — we list components in the order
 * they appear in the form so the sentence reads naturally.
 */
const COMPONENT_LABELS: Record<string, string> = {
	route: "street name",
	locality: "city",
	sublocality: "city",
	administrative_area_level_1: "state",
	postal_code: "ZIP code",
};

const COMPONENT_ORDER = [
	"route",
	"locality",
	"sublocality",
	"administrative_area_level_1",
	"postal_code",
];

function labelsForComponents(types: string[]): string[] {
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const t of COMPONENT_ORDER) {
		if (types.includes(t)) {
			const label = COMPONENT_LABELS[t];
			if (label && !seen.has(label)) {
				seen.add(label);
				labels.push(label);
			}
		}
	}
	return labels;
}

function joinLabels(labels: string[]): string {
	if (labels.length === 0) return "the highlighted fields";
	if (labels.length === 1) return `the ${labels[0]}`;
	if (labels.length === 2) return `the ${labels[0]} and ${labels[1]}`;
	return `the ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function copyFor(
	kind: AddressValidationKind,
	unconfirmedComponentTypes: string[],
): Copy {
	switch (kind) {
		case "missing_subpremise":
			return {
				title: "Confirm your unit number",
				banner: {
					tone: "warn",
					text: "We detected this may be a multi-unit or apartment building. Please add your unit number, or let us know if it's a single-family home.",
				},
				line2Placeholder: "Apartment or unit number",
				continueLabel: "Continue",
				secondaryAction: {
					label: "This is a single-family home",
					clearsLine2: true,
				},
			};
		case "confirm_subpremise":
			return {
				title: "Confirm your unit or meter detail",
				banner: {
					tone: "warn",
					text: "We couldn't verify this with USPS — that's okay for separate meters like apartments, guest houses, barns, or trailers. Please confirm it's correct.",
				},
				line2Placeholder:
					"Apartment, unit, or structure (e.g., guest house, barn)",
				continueLabel: "Confirm",
			};
		case "confirm_street_number":
			return {
				title: "Confirm your address",
				banner: {
					tone: "warn",
					text: "We couldn't verify this address with USPS — this is common for new builds and rural addresses. Please confirm it's correct.",
				},
				line2Placeholder: "Apartment, unit, or structure (optional)",
				continueLabel: "Confirm",
			};
		case "confirm_components": {
			const phrase = joinLabels(labelsForComponents(unconfirmedComponentTypes));
			return {
				title: "Confirm your address",
				banner: {
					tone: "warn",
					text: `We couldn't verify ${phrase}. Please double-check or edit.`,
				},
				line2Placeholder: "Apartment, unit, or structure (optional)",
				continueLabel: "Confirm",
			};
		}
		case "block":
			return {
				title: "We couldn't find this address",
				banner: {
					tone: "error",
					text: "Please edit the address and try again.",
				},
				line2Placeholder: "Apartment, unit, or structure (optional)",
				continueLabel: "Continue",
			};
		default:
			return {
				title: "Confirm your address",
				line2Placeholder: "Apartment, unit, or structure (optional)",
				continueLabel: "Continue",
			};
	}
}

function useFieldHighlight(
	validationResult: AddressValidationResult,
): (field: UnconfirmedFieldType) => boolean {
	return useMemo(() => {
		const set = new Set(validationResult.unconfirmedFields);
		return (field: UnconfirmedFieldType) => set.has(field);
	}, [validationResult.unconfirmedFields]);
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
	console.log("googleAddressComponents", googleAddressComponents);
	console.log("selection", selection);
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
			posthogCapture("address_validation_override", {
				kind: validationResult.kind,
				user_action: userAction,
				inputFormattedAddress: selection.formattedAddress,
				submittedFormattedAddress: result.formattedAddress,
				editedLine1: line1.trim() !== googleAddressComponents.line1,
				editedLine2:
					!omitLine2 && line2.trim() !== googleAddressComponents.line2,
				editedCity: city.trim() !== googleAddressComponents.city,
				editedState: state.trim() !== googleAddressComponents.state,
				editedPostalCode:
					postalCode.trim() !== googleAddressComponents.postalCode,
			});
			onContinue(result);
		},
		[
			buildResult,
			city,
			googleAddressComponents,
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
			line1.trim() !== googleAddressComponents.line1 ||
			line2.trim() !== googleAddressComponents.line2 ||
			city.trim() !== googleAddressComponents.city ||
			state.trim() !== googleAddressComponents.state ||
			postalCode.trim() !== googleAddressComponents.postalCode;
		submit(edited ? "edited" : "confirmed_as_is");
	}, [
		city,
		googleAddressComponents,
		line1,
		line2,
		line2Missing,
		postalCode,
		state,
		submit,
	]);

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
					<input
						ref={line1Ref}
						type="text"
						value={line1}
						onChange={(e) => setLine1(e.target.value)}
						placeholder="Street address"
						className={cx(
							styles.addressConfirmInput,
							isFieldHighlighted("line1") && styles.addressConfirmInputWarn,
						)}
						aria-invalid={isFieldHighlighted("line1") || undefined}
					/>
					<input
						ref={line2Ref}
						type="text"
						value={line2}
						onChange={(e) => setLine2(e.target.value)}
						placeholder={copy.line2Placeholder}
						className={cx(
							styles.addressConfirmInput,
							line2Missing && styles.addressConfirmInputError,
							!line2Missing &&
								isFieldHighlighted("line2") &&
								styles.addressConfirmInputWarn,
						)}
						aria-invalid={line2Missing || undefined}
						aria-describedby={line2Missing ? line2WarningId : undefined}
					/>
					{line2Missing && (
						<span
							id={line2WarningId}
							className={styles.addressConfirmErrorText}
						>
							Please enter your unit number, or choose &ldquo;single-family
							home&rdquo; below
						</span>
					)}
					<div className={styles.addressConfirmGrid}>
						<input
							type="text"
							value={city}
							onChange={(e) => setCity(e.target.value)}
							placeholder="City"
							className={cx(
								styles.addressConfirmInput,
								isFieldHighlighted("city") && styles.addressConfirmInputWarn,
							)}
							aria-invalid={isFieldHighlighted("city") || undefined}
						/>
						<input
							type="text"
							value={state}
							onChange={(e) => setState(e.target.value)}
							placeholder="State"
							className={cx(
								styles.addressConfirmInput,
								isFieldHighlighted("state") && styles.addressConfirmInputWarn,
							)}
							aria-invalid={isFieldHighlighted("state") || undefined}
						/>
						<input
							type="text"
							value={postalCode}
							onChange={(e) => setPostalCode(e.target.value)}
							placeholder="ZIP"
							className={cx(
								styles.addressConfirmInput,
								isFieldHighlighted("postalCode") &&
									styles.addressConfirmInputWarn,
							)}
							aria-invalid={isFieldHighlighted("postalCode") || undefined}
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
