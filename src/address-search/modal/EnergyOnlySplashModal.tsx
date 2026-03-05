import { useEffect, useRef, useState } from "react";
import { posthogCapture } from "@/address-search/utils";
import styles from "./styles.module.css";

// delay for step completion animation rendering
const STEP_DURATION_MS = 1000;

const STEPS = [
	"Verifying address",
	"Checking utility",
	"Preparing report",
] as const;

function CheckIcon({ complete }: { complete: boolean }) {
	if (complete) {
		return (
			<svg
				width="30"
				height="30"
				viewBox="0 0 30 30"
				fill="none"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M25.2636 15.0004C25.2636 20.6686 20.6686 25.2636 15.0004 25.2636C9.33223 25.2636 4.73725 20.6686 4.73725 15.0004C4.73725 9.33223 9.33223 4.73725 15.0004 4.73725C20.6686 4.73725 25.2636 9.33223 25.2636 15.0004Z"
					fill="#B2DD79"
				/>
				<path
					d="M23.4873 15.0004C23.4873 10.3133 19.6876 6.51357 15.0004 6.51357C10.3133 6.51357 6.51357 10.3133 6.51357 15.0004C6.51357 19.6876 10.3133 23.4873 15.0004 23.4873C19.6876 23.4873 23.4873 19.6876 23.4873 15.0004ZM27.0399 15.0004C27.0399 21.6496 21.6496 27.0399 15.0004 27.0399C8.35119 27.0399 2.96094 21.6496 2.96094 15.0004C2.96094 8.35119 8.35119 2.96094 15.0004 2.96094C21.6496 2.96094 27.0399 8.35119 27.0399 15.0004Z"
					fill="#B2DD79"
				/>
				<path
					d="M23.4478 15.0004C23.4478 10.3351 19.6658 6.55304 15.0004 6.55304C10.3351 6.55304 6.55304 10.3351 6.55304 15.0004C6.55304 19.6658 10.3351 23.4478 15.0004 23.4478V25.2636C9.33223 25.2636 4.73725 20.6686 4.73725 15.0004C4.73725 9.33223 9.33223 4.73725 15.0004 4.73725C20.6686 4.73725 25.2636 9.33223 25.2636 15.0004C25.2636 20.6686 20.6686 25.2636 15.0004 25.2636V23.4478C19.6658 23.4478 23.4478 19.6658 23.4478 15.0004Z"
					fill="#1E4D2B"
				/>
				<path
					d="M19.1876 10.9094C19.485 10.5187 20.0428 10.4429 20.4335 10.7403C20.8243 11.0376 20.9 11.5954 20.6027 11.9861L15.1261 19.1832C14.3108 20.2546 12.7377 20.3609 11.7857 19.4089L9.39808 17.0213C9.05089 16.6741 9.05089 16.1112 9.39808 15.764C9.74527 15.4168 10.3082 15.4168 10.6554 15.764L13.043 18.1516C13.2334 18.342 13.5481 18.3208 13.7111 18.1065L19.1876 10.9094Z"
					fill="#1E4D2B"
				/>
			</svg>
		);
	}
	return (
		<svg
			width="30"
			height="30"
			viewBox="0 0 30 30"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="15" cy="15" r="14" stroke="#d8d7d5" strokeWidth="1" />
		</svg>
	);
}

export type EnergyOnlySplashModalProps = {
	address: string;
	redirectUrl: string;
	onRedirect: (redirectUrl: string) => void;
	onBack: () => void;
};

export function EnergyOnlySplashModal({
	address,
	redirectUrl,
	onRedirect,
}: EnergyOnlySplashModalProps) {
	const [completedSteps, setCompletedSteps] = useState(0);
	const hasRedirected = useRef(false);

	useEffect(() => {
		posthogCapture("energy_only_splash_shown", { address });

		const timers = STEPS.map((_, index) =>
			setTimeout(
				() => {
					setCompletedSteps(index + 1);
					if (index === STEPS.length - 1 && !hasRedirected.current) {
						hasRedirected.current = true;
						posthogCapture("energy_only_splash_redirect", { redirectUrl });
						// small delay before redirect, ensure final step checkmark is rendered
						setTimeout(() => onRedirect(redirectUrl), 300);
					}
				},
				STEP_DURATION_MS * (index + 1),
			),
		);

		return () => timers.forEach(clearTimeout);
	}, [address, redirectUrl, onRedirect]);

	return (
		<div className={styles.splashOverlay}>
			<div className={styles.splashCard}>
				<div className={styles.splashSpinnerWrapper}>
					<div className={styles.splashSpinner} aria-hidden="true" />
				</div>
				<div className={styles.splashCardContent}>
					<div className={styles.splashTextGroup}>
						<p className={styles.splashTitle}>Calculating your savings...</p>
						<p className={styles.splashSubtitle}>This only takes a moment.</p>
					</div>
					<div className={styles.splashSteps}>
						{STEPS.map((label, index) => {
							const isComplete = index < completedSteps;
							return (
								<div key={label} className={styles.splashStep}>
									<CheckIcon complete={isComplete} />
									<span
										className={
											isComplete
												? styles.splashStepLabelComplete
												: styles.splashStepLabel
										}
										data-label={label}
									>
										{label}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
