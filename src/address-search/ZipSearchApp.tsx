import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CtaButton } from "@/address-search/CtaButton";
import { fetchZipRouting } from "@/address-search/fetch";
import type { RedirectMultipleOption } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { rebaseToZipFunnel } from "@/address-search/zipFunnel";
import { cx } from "@/utils/cx";
import MapPin from "./MapPin";
import { UtilitySelectionModal } from "./modal/UtilitySelectionModal";
import styles from "./styles.module.css";

export type ZipSearchAppProps = {
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

// Fixed on purpose: the embed's `placeholder` attribute serves the control arm
// (address search) of the same element, so the zip entry owns its own copy.
const ZIP_PLACEHOLDER = "Enter your zip code";

/**
 * Zip-first funnel entry. A lower-commitment alternative to the full address
 * search: the user enters a zip, the backend (dashboard-web /api/zip-router →
 * growth GetRoutingFromZip) resolves the funnel URL, and overlapping utilities
 * are disambiguated in-flow with the shared utility selector before redirect.
 */
export function ZipSearchApp({
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
	const openedRef = useRef(false);

	// Funnel step 1 ("zip entry clicked open"): first interaction with the input.
	const handleFocus = useCallback(() => {
		if (openedRef.current) return;
		openedRef.current = true;
		posthogCapture("zip_search_opened", {});
	}, []);

	// Funnel step 3 ("zip entry redirecting"): rebase to the zip funnel, capture
	// before dispatch so the event isn't lost to the navigation, then hand the
	// URL to the host page. Shared by the single-result and utility-modal paths.
	const emitRedirect = useCallback(
		(redirectUrl: string, utility?: string) => {
			const normalized = normalizeZip(zip);
			const rebased = rebaseToZipFunnel(redirectUrl);
			posthogCapture("zip_search_redirect", {
				zip: normalized,
				utility,
				redirectUrl: rebased,
			});
			onResultEvent({
				result: { redirectUrl: rebased },
				zip: normalized,
				utility,
			});
		},
		[onResultEvent, zip],
	);

	const submit = useCallback(async () => {
		if (loading) return;
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
		emitRedirect(result.data.redirectUrl, strategy.utility);
	}, [zip, loading, emitRedirect, onErrorEvent]);

	const handleBack = useCallback(() => {
		setUtilityOptions(undefined);
	}, []);

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
					onFocus={handleFocus}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							submit();
						}
					}}
					placeholder={ZIP_PLACEHOLDER}
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

			{error && (
				<p className={cx(styles.energyFormInputErrorText, styles.zipErrorText)}>
					{error}
				</p>
			)}

			{!!cta && !loading && (
				<CtaButton title={cta} onClick={submit} className={styles.mobileBtn} />
			)}

			{utilityOptions &&
				createPortal(
					<UtilitySelectionModal
						address={zip}
						externalAddressId=""
						utilityOptions={utilityOptions}
						skipUtilityConfirm
						onTriggerRedirect={emitRedirect}
						onBack={handleBack}
					/>,
					portalRoot,
				)}
		</div>
	);
}
