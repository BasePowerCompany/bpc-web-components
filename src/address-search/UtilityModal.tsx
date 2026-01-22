import { setUtilityUserConfirmed } from "@/address-search/fetch";
import type {
	AddressResult,
	RedirectMultipleOption,
} from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import styles from "./styles.module.css";

export type UtilityModalProps = {
	address: string;
	addressSelected: AddressResult;
	externalAddressId: string;
	utilityOptions: RedirectMultipleOption[];
	onComplete: (redirectUrl: string) => void;
	showMultipleUtilityOptions: boolean;
	onBack: () => void;
};

const UtilityValueToLogoMap: Record<string, string> = {
	FARMERS:
		"https://bpc-web-static-files.s3.us-east-2.amazonaws.com/Farmers-Logo.png",
};

export function UtilityModal({
	address,
	addressSelected,
	externalAddressId,
	utilityOptions,
	onComplete,
	onBack,
	showMultipleUtilityOptions,
}: UtilityModalProps) {
	if (!showMultipleUtilityOptions) {
		return null;
	}

	const handleSelectUtility = async (option: RedirectMultipleOption) => {
		const utility = option.value;

		// Try to find the utility selection for the multiple result.
		const found = utilityOptions.find((opt) => opt.value === utility);
		if (!found) {
			posthogCapture("address_search_modal_selection_not_found", {
				selection: addressSelected,
				utility: utility,
				utilityOptions,
			});
			return;
		}

		// If utility is "OTHER", Don't set utility user confirmed, just complete.
		if (utility === "OTHER") {
			posthogCapture("address_search_modal_selection_utility_other", {
				selection: addressSelected,
				utility: utility,
				multipleResult: found,
			});
			onComplete(found.redirectUrl);
			return;
		}

		// If we can't find an external address id, return (shouldn't ever get here).
		if (!externalAddressId) {
			posthogCapture(
				"address_search_multiple_result_unreachable_external_address_id_not_found",
				{
					selection: addressSelected,
					utility: utility,
					externalAddressId,
				},
			);
			return;
		}

		// Set the user-confirmed utility.
		try {
			await setUtilityUserConfirmed(utility, externalAddressId);
			posthogCapture("address_search_set_utility_confirmed_success", {
				selection: addressSelected,
				utility: utility,
				externalAddressId,
			});
		} catch (err) {
			posthogCapture("address_search_set_utility_confirmed_error", {
				selection: addressSelected,
				utility: utility,
				externalAddressId,
			});
			console.error("Error setting utility user confirmed", err);
		}

		// Complete with the redirect URL
		onComplete(found.redirectUrl);
	};

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
											onClick={() => handleSelectUtility(option)}
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
