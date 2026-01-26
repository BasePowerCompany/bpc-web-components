import { useState } from "react";
import type {
	AddressResult,
	RedirectMultipleAddress,
} from "@/address-search/types";
import { ModalLayout } from "./ModalLayout";
import styles from "./styles.module.css";

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

function RadioButton({ selected }: { selected: boolean }) {
	return (
		<div className={styles.addressRadio}>
			<div
				className={`${styles.radioCircle} ${selected ? styles.radioCircleSelected : ""}`}
			>
				{selected && <div className={styles.radioCircleInner} />}
			</div>
		</div>
	);
}

export type AddressSelectionModalProps = {
	address: string;
	addressOptions: RedirectMultipleAddress;
	onSelectAddress: (address: AddressResult) => void;
	onBack: () => void;
};

export function AddressSelectionModal({
	address,
	addressOptions,
	onSelectAddress,
	onBack,
}: AddressSelectionModalProps) {
	const [selectedAddress, setSelectedAddress] = useState<
		"existing" | "original"
	>("existing");

	const existingAddress = addressOptions.existingAddress;
	const originalAddress = addressOptions.originalAddress;

	const handleContinue = () => {
		const selected =
			selectedAddress === "existing" ? existingAddress : originalAddress;
		onSelectAddress(selected);
	};

	const formatAddressLine1 = (addr: AddressResult) => addr.address.line1;
	const formatAddressLine2 = (addr: AddressResult) =>
		`${addr.address.city}, ${addr.address.state} ${addr.address.postalCode}`;

	return (
		<ModalLayout onBack={onBack}>
			<div className={styles.enteredAddressSection}>
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
						<RadioButton selected={selectedAddress === "existing"} />
						<div className={styles.addressText}>
							<p className={styles.addressLine1Existing}>
								{formatAddressLine1(existingAddress)}
							</p>
							<p className={styles.addressLine2Existing}>
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
						<RadioButton selected={selectedAddress === "original"} />
						<div className={styles.addressText}>
							<p className={styles.addressLine1Original}>
								{formatAddressLine1(originalAddress)}
							</p>
							<p className={styles.addressLine2Original}>
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
					<ArrowIcon />
				</button>
			</div>
		</ModalLayout>
	);
}
