import { forwardRef } from "react";
import { cx } from "@/utils/cx";
import styles from "./styles.module.css";

export type ConfirmFieldProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	/** Amber warning border for unconfirmed components. */
	highlighted?: boolean;
	/** Red error border for required-but-missing fields. Takes precedence
	 *  over `highlighted` when both are true. */
	error?: boolean;
	/** Inline error message rendered under the field. */
	errorText?: string;
	errorId?: string;
};

/**
 * Single text input for the address confirm modal. Encapsulates the warn /
 * error visual states + aria wiring so the modal JSX reads as a form schema.
 */
export const ConfirmField = forwardRef<HTMLInputElement, ConfirmFieldProps>(
	function ConfirmField(
		{ value, onChange, placeholder, highlighted, error, errorText, errorId },
		ref,
	) {
		return (
			<>
				<input
					ref={ref}
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className={cx(
						styles.addressConfirmInput,
						error && styles.addressConfirmInputError,
						!error && highlighted && styles.addressConfirmInputWarn,
					)}
					aria-invalid={error || highlighted || undefined}
					aria-describedby={error && errorId ? errorId : undefined}
				/>
				{error && errorText && (
					<span id={errorId} className={styles.addressConfirmErrorText}>
						{errorText}
					</span>
				)}
			</>
		);
	},
);
