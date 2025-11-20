import { cx } from "@/utils/cx";
import styles from "./styles.module.css";

export function CtaButton({
	title,
	className,
	...rest
}: {
	title: string;
	className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			className={cx(styles.activateButton, className)}
			tabIndex={-1}
			{...rest}
		>
			{title}
		</button>
	);
}
