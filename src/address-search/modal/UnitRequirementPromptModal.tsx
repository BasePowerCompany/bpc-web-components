import { useCallback, useEffect, useId, useRef } from "react";
import {
	type AddressValidationResult,
	validationEventProperties,
} from "@/address-search/addressValidation";
import { CloseIcon } from "@/address-search/icons/CloseIcon";
import type { AddressResult } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { cx } from "@/utils/cx";
import styles from "./styles.module.css";

export type UnitRequirementPromptModalProps = {
	selection: AddressResult;
	validationResult: AddressValidationResult;
	validationSessionId: string;
	loading: boolean;
	onNeedsUnit: () => void;
	onNoUnit: () => void;
	onClose: () => void;
};

export function UnitRequirementPromptModal({
	selection,
	validationResult,
	validationSessionId,
	loading,
	onNeedsUnit,
	onNoUnit,
	onClose,
}: UnitRequirementPromptModalProps) {
	const titleId = useId();
	const descriptionId = useId();
	const firstButtonRef = useRef<HTMLButtonElement>(null);
	const hasLoggedShown = useRef(false);

	useEffect(() => {
		requestAnimationFrame(() => firstButtonRef.current?.focus());
	}, []);

	useEffect(() => {
		if (hasLoggedShown.current) return;
		hasLoggedShown.current = true;
		posthogCapture("address_validation_result", {
			...validationEventProperties(validationResult, validationSessionId),
			inputFormattedAddress: selection.formattedAddress,
			confirmation_path: "unit_requirement_prompt",
		});
	}, [validationResult, selection.formattedAddress, validationSessionId]);

	const captureResponse = useCallback(
		(response: "needs_unit" | "no_unit") => {
			posthogCapture("address_unit_requirement_response", {
				...validationEventProperties(validationResult, validationSessionId),
				response,
				inputFormattedAddress: selection.formattedAddress,
			});
		},
		[selection.formattedAddress, validationResult, validationSessionId],
	);

	const handleNeedsUnit = useCallback(() => {
		captureResponse("needs_unit");
		onNeedsUnit();
	}, [captureResponse, onNeedsUnit]);

	const handleNoUnit = useCallback(() => {
		captureResponse("no_unit");
		onNoUnit();
	}, [captureResponse, onNoUnit]);

	const handleClose = useCallback(() => {
		posthogCapture("address_validation_dismiss", {
			...validationEventProperties(validationResult, validationSessionId),
			inputFormattedAddress: selection.formattedAddress,
			confirmation_path: "unit_requirement_prompt",
		});
		onClose();
	}, [
		onClose,
		selection.formattedAddress,
		validationResult,
		validationSessionId,
	]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click-to-dismiss is a standard modal pattern
		<div
			className={styles.addressConfirmBackdrop}
			onClick={(e) => {
				if (e.target === e.currentTarget && !loading) handleClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape" && !loading) handleClose();
			}}
		>
			<div
				className={styles.unitPromptCard}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
			>
				<button
					type="button"
					className={styles.addressConfirmCloseIcon}
					onClick={handleClose}
					aria-label="Close"
					disabled={loading}
				>
					<CloseIcon />
				</button>

				<div className={styles.unitPromptHeader}>
					<p className={styles.unitPromptEyebrow}>One quick check</p>
					<h2 id={titleId} className={styles.unitPromptTitle}>
						Do you have an apartment or unit number?
					</h2>
					<p id={descriptionId} className={styles.unitPromptDescription}>
						Some addresses include apartments, condos, suites, or other units.
						If yours does, add it next so we can match the right home.
					</p>
				</div>

				<div className={styles.unitPromptAddress}>
					<span className={styles.unitPromptAddressLabel}>
						Selected address
					</span>
					<span className={styles.unitPromptAddressText}>
						{selection.formattedAddress}
					</span>
				</div>

				<div className={styles.unitPromptOptions}>
					<button
						ref={firstButtonRef}
						type="button"
						className={cx(
							styles.unitPromptOption,
							styles.unitPromptOptionPrimary,
						)}
						onClick={handleNeedsUnit}
						disabled={loading}
					>
						<span
							className={styles.unitPromptOptionIndicator}
							aria-hidden="true"
						/>
						<span className={styles.unitPromptOptionCopy}>
							<span className={styles.unitPromptOptionTitle}>
								Yes, I have a unit number
							</span>
							<span className={styles.unitPromptOptionSubtitle}>
								Apartment, condo, suite, or other unit
							</span>
						</span>
					</button>

					<button
						type="button"
						className={styles.unitPromptOption}
						onClick={handleNoUnit}
						disabled={loading}
					>
						<span
							className={styles.unitPromptOptionIndicator}
							aria-hidden="true"
						/>
						<span className={styles.unitPromptOptionCopy}>
							<span className={styles.unitPromptOptionTitle}>
								No, this is a single-family home
							</span>
							<span className={styles.unitPromptOptionSubtitle}>
								Continue without a unit number
							</span>
						</span>
						{loading && <span className={styles.addressConfirmSpinner} />}
					</button>
				</div>
			</div>
		</div>
	);
}
