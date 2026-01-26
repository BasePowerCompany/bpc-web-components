import styles from "./styles.module.css";

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

export function ModalLayout({
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
