import { useEffect, useRef, useState } from "react";
import { posthogCapture } from "@/address-search/utils";
import { CheckCircleIcon } from "@/address-search/icons/CheckCircleIcon";
import { EmptyCircleIcon } from "@/address-search/icons/EmptyCircleIcon";
import styles from "./styles.module.css";

// delay for step completion animation rendering
const STEP_DURATION_MS = 1000;

const STEPS = [
	"Verifying address",
	"Checking utility",
	"Preparing report",
] as const;

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

		let redirectTimer: ReturnType<typeof setTimeout>;
		const timers = STEPS.map((_, index) =>
			setTimeout(
				() => {
					setCompletedSteps(index + 1);
					if (index === STEPS.length - 1 && !hasRedirected.current) {
						hasRedirected.current = true;
						posthogCapture("energy_only_splash_redirect", { redirectUrl });
						// small delay before redirect, ensure final step checkmark is rendered
						redirectTimer = setTimeout(() => onRedirect(redirectUrl), 300);
					}
				},
				STEP_DURATION_MS * (index + 1),
			),
		);

		return () => {
			timers.forEach(clearTimeout);
			clearTimeout(redirectTimer);
		};
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
									{isComplete ? <CheckCircleIcon /> : <EmptyCircleIcon />}
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
