import { useState } from "react";
import styles from "./styles.module.css";
import type { RedirectMultipleOption } from "./types";

export type UtilityModalProps = {
	address: string;
	utilityOptions: RedirectMultipleOption[];
	onSelectUtility: (option: RedirectMultipleOption) => void;
	showMultipleUtilityOptions: boolean;
	onBack: () => void;
};

const UtilityValueToLogoMap: Record<string, string> = {
	FARMERS:
		"https://bpc-web-static-files.s3.us-east-2.amazonaws.com/Farmers-Logo.png",
};

// Shared Components
function BackButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			className={styles.backButton}
			onClick={onClick}
			aria-label="Go back"
		>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<path
					d="M19 12H5M5 12L12 19M5 12L12 5"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}

function ArrowIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				d="M5 12H19M19 12L12 5M19 12L12 19"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ModalLayout({
	onBack,
	children,
}: {
	onBack: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className={styles.utilityModal}>
			<div className={styles.utilityModalContent}>
				<BackButton onClick={onBack} />
				<div className={styles.utilityModalBody}>
					<div className={styles.utilityModalBodyContent}>{children}</div>
				</div>
			</div>
			<div className={styles.utilityModalImage} />
		</div>
	);
}

// Utility Selection View
function UtilitySelectionContent({
	address,
	utilityOptions,
	onSelectUtility,
}: {
	address: string;
	utilityOptions: RedirectMultipleOption[];
	onSelectUtility: (option: RedirectMultipleOption) => void;
}) {
	return (
		<>
			<div>
				<p className={styles.addressLabel}>{address}</p>
				<h1 className={styles.utilityModalTitle}>Who's your local utility?</h1>
				<p className={styles.utilityModalSubtitle}>
					So we can show the right plan and next steps for this address.
				</p>
			</div>

			<div className={styles.utilitySelectContent}>
				<div className={styles.utilityOptions}>
					{utilityOptions.map((option) => {
						const logoUrl = UtilityValueToLogoMap[option.value];
						return (
							<button
								key={option.name}
								type="button"
								className={styles.utilityOption}
								onClick={() => onSelectUtility(option)}
							>
								<div className={styles.utilityOptionInner}>
									<p className={styles.utilityName}>{option.name}</p>
									{logoUrl ? (
										<img
											src={logoUrl}
											alt={`${option.name} logo`}
											className={styles.utilityLogo}
										/>
									) : (
										<div />
									)}
								</div>
							</button>
						);
					})}
				</div>

				<div className={styles.helpSection}>
					<p className={styles.helpTitle}>Not sure?</p>
					<p className={styles.helpText}>
						Look at your bill for the "Delivery" or "TDU" section
					</p>
					<p className={styles.helpText}>
						Search your inbox for outage texts or alerts
					</p>
					<p className={styles.helpContact}>
						Still can't find it? Email us:{" "}
						<a href="mailto:team@basepowercompany.com">
							team@basepowercompany.com
						</a>
					</p>
				</div>
			</div>
		</>
	);
}

export function UtilityModal({
	address,
	utilityOptions,
	onSelectUtility,
	onBack,
	showMultipleUtilityOptions,
}: UtilityModalProps) {
	if (showMultipleUtilityOptions) {
		return (
			<ModalLayout onBack={onBack}>
				<UtilitySelectionContent
					address={address}
					utilityOptions={utilityOptions}
					onSelectUtility={onSelectUtility}
				/>
			</ModalLayout>
		);
	}
	return null;
}
