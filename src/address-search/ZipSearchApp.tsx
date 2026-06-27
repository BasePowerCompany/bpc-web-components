import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { CtaButton } from "@/address-search/CtaButton";
import { fetchZipRouting } from "@/address-search/fetch";
import type { RedirectMultipleOption } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import MapPin from "./MapPin";
import { UtilitySelectionModal } from "./modal/UtilitySelectionModal";
import styles from "./styles.module.css";

export type ZipSearchAppProps = {
	placeholder?: string;
	cta?: string;
	portalRoot: ShadowRoot;
	onResultEvent: (detail: {
		result: { redirectUrl: string };
		zip: string;
		utility?: string;
	}) => void;
	onErrorEvent: (detail: { error: string }) => void;
};

function normalizeZip(value: string): string {
	return value.replace(/\D/g, "").slice(0, 5);
}

/**
 * Zip-first funnel entry. A lower-commitment alternative to the full address
 * search: the user enters a zip, the backend (dashboard-web /api/zip-router →
 * growth GetRoutingFromZip) resolves the funnel URL, and overlapping utilities
 * are disambiguated in-flow with the shared utility selector before redirect.
 */
export function ZipSearchApp({
	placeholder,
	cta,
	portalRoot,
	onResultEvent,
	onErrorEvent,
}: ZipSearchAppProps) {
	const [zip, setZip] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [utilityOptions, setUtilityOptions] = useState<
		RedirectMultipleOption[] | undefined
	>();

	const submit = useCallback(async () => {
		const normalized = normalizeZip(zip);
		if (normalized.length < 5) {
			setError("Please enter a valid 5-digit ZIP code.");
			posthogCapture("zip_search_invalid", { zip: normalized });
			return;
		}

		setError(undefined);
		setLoading(true);
		posthogCapture("zip_search_submit", { zip: normalized });

		let result: Awaited<ReturnType<typeof fetchZipRouting>>;
		try {
			result = await fetchZipRouting(normalized);
		} finally {
			setLoading(false);
		}

		if (!result.success) {
			setError("Something went wrong. Please try again.");
			posthogCapture("zip_search_no_result", {
				zip: normalized,
				error: result.error,
			});
			onErrorEvent({ error: result.error });
			return;
		}

		const strategy = result.data.redirectStrategy;
		if (strategy.isMultiple) {
			posthogCapture("zip_search_multiple_utility_result", {
				zip: normalized,
				utilityOptions: strategy.multiple.options,
			});
			setUtilityOptions(strategy.multiple.options);
			return;
		}

		posthogCapture("zip_search_single_result", {
			zip: normalized,
			utility: strategy.utility,
		});
		onResultEvent({
			result: { redirectUrl: result.data.redirectUrl },
			zip: normalized,
			utility: strategy.utility,
		});
	}, [zip, onResultEvent, onErrorEvent]);

	const handleUtilityRedirect = useCallback(
		(redirectUrl: string) => {
			onResultEvent({ result: { redirectUrl }, zip: normalizeZip(zip) });
		},
		[onResultEvent, zip],
	);

	const handleBack = useCallback(() => {
		setUtilityOptions(undefined);
	}, []);

	const resolvedPlaceholder = placeholder || "Enter your zip code";

	return (
		<div className={styles.autocomplete}>
			<div className={styles.inputContainer}>
				<input
					name="zip-search"
					value={zip}
					onChange={(e) => {
						setZip(normalizeZip(e.target.value));
						if (error) setError(undefined);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							submit();
						}
					}}
					placeholder={resolvedPlaceholder}
					inputMode="numeric"
					autoComplete="postal-code"
					maxLength={5}
					className={styles.input}
					aria-invalid={!!error}
				/>
				<MapPin className={styles.mapPin} />
				{loading && (
					<output className={styles.loadingSpinner} aria-label="Checking zip" />
				)}
				{!!cta && !loading && <CtaButton title={cta} onClick={submit} />}
			</div>

			{error && <p className={styles.energyFormInputErrorText}>{error}</p>}

			{!!cta && (
				<CtaButton title={cta} onClick={submit} className={styles.mobileBtn} />
			)}

			{utilityOptions &&
				createPortal(
					<UtilitySelectionModal
						address={zip}
						externalAddressId=""
						utilityOptions={utilityOptions}
						skipUtilityConfirm
						onTriggerRedirect={handleUtilityRedirect}
						onBack={handleBack}
					/>,
					portalRoot,
				)}
		</div>
	);
}
