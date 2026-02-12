import { useEffect, useRef } from "react";
import { posthogCapture } from "@/address-search/utils";
import { ModalLayout } from "./ModalLayout";
import styles from "./styles.module.css";

const SPLASH_DURATION_MS = 3000;

function BatteryIcon() {
	return (
		<svg
			width="144"
			height="72"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<rect
				x="2"
				y="6"
				width="18"
				height="12"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect x="5" y="9" width="4" height="6" rx="0.5" className={styles.splashBatteryFill} />
			<rect x="10.5" y="9" width="4" height="6" rx="0.5" className={styles.splashBatteryFill} />
			<path
				d="M22 10V14"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
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
	onBack,
}: EnergyOnlySplashModalProps) {
	const hasRedirected = useRef(false);

	useEffect(() => {
		posthogCapture("energy_only_splash_shown", { address });

		const timer = setTimeout(() => {
			if (!hasRedirected.current) {
				hasRedirected.current = true;
				posthogCapture("energy_only_splash_redirect", { redirectUrl });
				onRedirect(redirectUrl);
			}
		}, SPLASH_DURATION_MS);

		return () => clearTimeout(timer);
	}, [address, redirectUrl, onRedirect]);

	const handleBack = () => {
		hasRedirected.current = true;
		posthogCapture("energy_only_splash_dismissed", {});
		onBack();
	};

	return (
		<ModalLayout onBack={handleBack}>
			<div className={styles.splashContent}>
				<div>
					<h1 className={styles.utilityModalTitle}>
						Finding the best energy plan for you at
					</h1>
					<p className={styles.utilityModalSubtitle}>{address}</p>
				</div>
				<div className={styles.splashSpinner}>
					<BatteryIcon />
				</div>
			</div>
		</ModalLayout>
	);
}
