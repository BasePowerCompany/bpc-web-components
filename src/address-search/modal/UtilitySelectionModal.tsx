import { setUtilityUserConfirmed } from "@/address-search/fetch";
import type { RedirectMultipleOption } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { ModalLayout } from "./ModalLayout";
import styles from "./styles.module.css";

const UtilityValueToLogoMap: Record<string, string> = {
	FARMERS:
		"https://bpc-web-static-files.s3.us-east-2.amazonaws.com/Farmers-Logo.png",
};

export type UtilitySelectionModalProps = {
	address: string;
	externalAddressId: string;
	utilityOptions: RedirectMultipleOption[];
	onTriggerRedirect: (redirectUrl: string) => void;
	onBack: () => void;
};

export function UtilitySelectionModal({
	address,
	externalAddressId,
	utilityOptions,
	onTriggerRedirect,
	onBack,
}: UtilitySelectionModalProps) {
	const onSelectUtility = async (option: RedirectMultipleOption) => {
		const utility = option.value;

		const found = utilityOptions.find((opt) => opt.value === utility);
		if (!found) {
			posthogCapture("address_search_modal_selection_not_found", {
				addressSelected: address,
				utility: utility,
				utilityOptions,
			});
			return;
		}

		if (utility === "DEREG") {
			posthogCapture("address_search_modal_selection_utility_other", {
				addressSelected: address,
				utility: utility,
				multipleResult: found,
			});
			onTriggerRedirect(found.redirectUrl);
			return;
		}

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

		onTriggerRedirect(found.redirectUrl);
	};

	return (
		<ModalLayout onBack={onBack}>
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
		</ModalLayout>
	);
}
