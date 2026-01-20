import { useState } from "react";
import styles from "./styles.module.css";
import type {
	AddressResult,
	RedirectMultipleAddress,
	RedirectMultipleOption,
} from "./types";

export type UtilityModalProps = {
	address: string;
	utilityOptions: RedirectMultipleOption[];
	addressOptions: RedirectMultipleAddress | undefined;
	onSelectUtility: (option: RedirectMultipleOption) => void;
	onSelectAddress: (address_selected: AddressResult) => void;
	showMultipleUtilityOptions: boolean;
	showMultipleAddressOptions: boolean;
	onBack: () => void;
};

const UtilityValueToLogoMap: Record<string, string> = {
	FARMERS:
		"https://bpc-web-static-files.s3.us-east-2.amazonaws.com/Farmers-Logo.png",
};

export function UtilityModal({
	address,
	utilityOptions,
	onSelectUtility,
	onBack,
	showMultipleUtilityOptions,
	addressOptions,
	onSelectAddress,
	showMultipleAddressOptions,
}: UtilityModalProps) {
	// For address selection, default to existing_address (recommended)
	const [selectedAddress, setSelectedAddress] = useState<
		"existing" | "original"
	>("existing");

	if (showMultipleAddressOptions && addressOptions) {
		const existingAddress = addressOptions.existing_address;
		const originalAddress = addressOptions.original_address;

		const handleContinue = () => {
			const selected =
				selectedAddress === "existing" ? existingAddress : originalAddress;
			onSelectAddress(selected);
		};

		// Parse address into line1 and city/state/zip
		const formatAddressLine1 = (addr: AddressResult) => addr.address.line1;
		const formatAddressLine2 = (addr: AddressResult) =>
			`${addr.address.city}, ${addr.address.state} ${addr.address.postalCode}`;

		return (
			<div className={styles.utilityModal}>
				<div className={styles.utilityModalContent}>
					<button
						type="button"
						className={styles.backButton}
						onClick={onBack}
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

					<div className={styles.utilityModalBody}>
						<div className={styles.utilityModalBodyContent}>
							<div>
								<p className={styles.addressLabelSmall}>YOU ENTERED:</p>
								<p className={styles.addressLabelBold}>{address}</p>
							</div>

							<div className={styles.addressSelectContent}>
								<h1 className={styles.utilityModalTitle}>
									We found 2 possible addresses:
								</h1>
								<p className={styles.utilityModalSubtitle}>
									Help us find the right serviceable address for your home.
								</p>

								<div className={styles.addressOptions}>
									<button
										type="button"
										className={`${styles.addressOption} ${selectedAddress === "existing" ? styles.addressOptionSelected : ""}`}
										onClick={() => setSelectedAddress("existing")}
									>
										<div className={styles.addressRadio}>
											<div
												className={`${styles.radioCircle} ${selectedAddress === "existing" ? styles.radioCircleSelected : ""}`}
											>
												{selectedAddress === "existing" && (
													<div className={styles.radioCircleInner} />
												)}
											</div>
										</div>
										<div className={styles.addressText}>
											<p className={styles.addressLine1}>
												{formatAddressLine1(existingAddress)}
											</p>
											<p className={styles.addressLine2}>
												{formatAddressLine2(existingAddress)}
											</p>
										</div>
										<span className={styles.recommendedBadge}>RECOMMENDED</span>
									</button>

									<button
										type="button"
										className={`${styles.addressOption} ${selectedAddress === "original" ? styles.addressOptionSelected : ""}`}
										onClick={() => setSelectedAddress("original")}
									>
										<div className={styles.addressRadio}>
											<div
												className={`${styles.radioCircle} ${selectedAddress === "original" ? styles.radioCircleSelected : ""}`}
											>
												{selectedAddress === "original" && (
													<div className={styles.radioCircleInner} />
												)}
											</div>
										</div>
										<div className={styles.addressText}>
											<p className={styles.addressLine1}>
												{formatAddressLine1(originalAddress)}
											</p>
											<p className={styles.addressLine2}>
												{formatAddressLine2(originalAddress)}
											</p>
										</div>
									</button>
								</div>

								<button
									type="button"
									className={styles.continueButton}
									onClick={handleContinue}
								>
									Continue
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
								</button>
							</div>
						</div>
					</div>
				</div>
				<div className={styles.utilityModalImage} />
			</div>
		);
	}
	if (showMultipleUtilityOptions) {
		return (
			<div className={styles.utilityModal}>
				<div className={styles.utilityModalContent}>
					<button
						type="button"
						className={styles.backButton}
						onClick={onBack}
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

					<div className={styles.utilityModalBody}>
						<div className={styles.utilityModalBodyContent}>
							<div>
								<p className={styles.addressLabel}>{address}</p>
								<h1 className={styles.utilityModalTitle}>
									Who's your local utility?
								</h1>
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
						</div>
					</div>
				</div>
				<div className={styles.utilityModalImage} />
			</div>
		);
	}
	return null;
}
