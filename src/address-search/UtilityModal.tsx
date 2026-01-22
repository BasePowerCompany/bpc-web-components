import { setUtilityUserConfirmed } from "@/address-search/fetch";
import type { RedirectMultipleOption } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import styles from "./styles.module.css";

export type UtilityModalProps = {
	address: string;
	externalAddressId: string;
	utilityOptions: RedirectMultipleOption[];
	onTriggerRedirect: (redirectUrl: string) => void;
	showMultipleUtilityOptions: boolean;
	onBack: () => void;
};

const UtilityValueToLogoMap: Record<string, string> = {
	FARMERS:
		"https://bpc-web-static-files.s3.us-east-2.amazonaws.com/Farmers-Logo.png",
};

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

// Utility Selection View
function UtilitySelectionContent({
	address,
	externalAddressId,
	utilityOptions,
	onTriggerRedirect,
}: {
	address: string;
	externalAddressId: string;
	utilityOptions: RedirectMultipleOption[];
	onTriggerRedirect: (redirectUrl: string) => void;
}) {
	const onSelectUtility = async (option: RedirectMultipleOption) => {
		const utility = option.value;

		// Try to find the utility selection for the multiple result.
		const found = utilityOptions.find((opt) => opt.value === utility);
		if (!found) {
			posthogCapture("address_search_modal_selection_not_found", {
				addressSelected: address,
				utility: utility,
				utilityOptions,
			});
			return;
		}

		// If utility is "OTHER", Don't set utility user confirmed, just complete.
		if (utility === "OTHER") {
			posthogCapture("address_search_modal_selection_utility_other", {
				addressSelected: address,
				utility: utility,
				multipleResult: found,
			});
			onTriggerRedirect(found.redirectUrl);
			return;
		}

		// If we can't find an external address id, return (shouldn't ever get here).
		if (!externalAddressId) {
			posthogCapture(
				"address_search_multiple_result_unreachable_external_address_id_not_found",
				{
					addressSelected: address,
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
				addressSelected: address,
				utility: utility,
				externalAddressId,
			});
		} catch (err) {
			posthogCapture("address_search_set_utility_confirmed_error", {
				addressSelected: address,
				utility: utility,
				externalAddressId,
			});
			console.error("Error setting utility user confirmed", err);
		}

		// Complete with the redirect URL
		onTriggerRedirect(found.redirectUrl);
	};

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
									{logoUrl && (
										<img
											src={logoUrl}
											alt={`${option.name} logo`}
											className={styles.utilityLogo}
										/>
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

export function UtilityModal({
	address,
	externalAddressId,
	utilityOptions,
	onTriggerRedirect,
	onBack,
	showMultipleUtilityOptions,
}: UtilityModalProps) {
	if (showMultipleUtilityOptions) {
		return (
			<ModalLayout onBack={onBack}>
				<UtilitySelectionContent
					address={address}
					externalAddressId={externalAddressId}
					utilityOptions={utilityOptions}
					onTriggerRedirect={onTriggerRedirect}
				/>
			</ModalLayout>
		);
	}
	return null;
}
