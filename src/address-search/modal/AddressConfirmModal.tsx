import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "@/address-search/icons/CloseIcon";
import type {
	AddressResult,
	ParsedGoogleAddressComponents,
} from "@/address-search/types";
import { cx } from "@/utils/cx";
import styles from "./styles.module.css";

export type AddressConfirmModalProps = {
	selection: AddressResult;
	googleAddressComponents: ParsedGoogleAddressComponents;
	requiresSubpremise: boolean;
	loading: boolean;
	onContinue: (result: AddressResult) => void;
	onClose: () => void;
};

export function AddressConfirmModal({
	selection,
	googleAddressComponents,
	requiresSubpremise,
	loading,
	onContinue,
	onClose,
}: AddressConfirmModalProps) {
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
	const showLine2WarningId = useId();
	const showLine2Warning = requiresSubpremise && !line2.trim();

	const focusLine2 = useCallback(() => {
		requestAnimationFrame(() => {
			line2Ref.current?.focus();
		});
	}, []);

	// Auto-focus line2 on mount
	useEffect(() => {
		focusLine2();
	}, [focusLine2]);

	const handleContinue = useCallback(() => {
		if (requiresSubpremise && !line2.trim()) {
			focusLine2();
			return;
		}

		const normalizedLine1 = [line1.trim(), line2.trim()]
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

		onContinue({
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
		});
	}, [
		city,
		focusLine2,
		line1,
		line2,
		onContinue,
		postalCode,
		requiresSubpremise,
		selection,
		state,
	]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click-to-dismiss is a standard modal pattern
		<div
			className={styles.addressConfirmBackdrop}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
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
					onClick={onClose}
					aria-label="Close"
				>
					<CloseIcon />
				</button>

				<h2 className={styles.addressConfirmTitle}>Confirm your address</h2>

				<div className={styles.addressConfirmForm}>
					<input
						type="text"
						value={line1}
						onChange={(e) => setLine1(e.target.value)}
						placeholder="Street address"
						className={styles.addressConfirmInput}
					/>
					<input
						ref={line2Ref}
						type="text"
						value={line2}
						onChange={(e) => setLine2(e.target.value)}
						placeholder="Apartment or unit number"
						className={cx(
							styles.addressConfirmInput,
							showLine2Warning && styles.addressConfirmInputError,
						)}
						aria-invalid={showLine2Warning}
						aria-describedby={showLine2Warning ? showLine2WarningId : undefined}
					/>
					{showLine2Warning && (
						<span
							id={showLine2WarningId}
							className={styles.addressConfirmErrorText}
						>
							Please enter your apartment or unit number
						</span>
					)}
					<div className={styles.addressConfirmGrid}>
						<input
							type="text"
							value={city}
							onChange={(e) => setCity(e.target.value)}
							placeholder="City"
							className={styles.addressConfirmInput}
						/>
						<input
							type="text"
							value={state}
							onChange={(e) => setState(e.target.value)}
							placeholder="State"
							className={styles.addressConfirmInput}
						/>
						<input
							type="text"
							value={postalCode}
							onChange={(e) => setPostalCode(e.target.value)}
							placeholder="ZIP"
							className={styles.addressConfirmInput}
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
								"Continue"
							)}
						</button>
						<button
							type="button"
							className={styles.addressConfirmCloseButton}
							onClick={onClose}
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
