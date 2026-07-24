import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CtaButton } from "@/address-search/CtaButton";
import { fetchZipRouting } from "@/address-search/fetch";
import { maybeWrapInPlanReveal } from "@/address-search/planReveal";
import type { RedirectMultipleOption } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";
import { rebaseToZipFunnel } from "@/address-search/zipFunnel";
import { cx } from "@/utils/cx";
import MapPin from "./MapPin";
import { UtilitySelectionModal } from "./modal/UtilitySelectionModal";
import styles from "./styles.module.css";

export type ZipSearchAppProps = {
	portalRoot: ShadowRoot;
	/** CTA label; defaults to "Check Availability" when the embed omits `cta`. */
	cta?: string;
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

// The zip entry owns its placeholder copy. Its CTA defaults to "Check
// Availability" but the embed can override it via the `cta` attribute.
const ZIP_PLACEHOLDER = "Enter your zip code";
const DEFAULT_ZIP_CTA = "Check Availability";

/**
 * Zip-first funnel entry. A lower-commitment alternative to the full address
 * search: the user enters a zip, the backend (dashboard-web /api/zip-router →
 * growth GetRoutingFromZip) resolves the funnel URL, and overlapping utilities
 * are disambiguated in-flow with the shared utility selector before redirect.
 */
export function ZipSearchApp({
	portalRoot,
	cta = DEFAULT_ZIP_CTA,
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

	// Funnel step 3 ("zip entry redirecting"): capture before dispatch so the
	// event isn't lost to the navigation, then hand the final URL to the host.
	const dispatchRedirect = useCallback(
		(finalUrl: string, utility?: string) => {
			const normalized = normalizeZip(zip);
			posthogCapture("zip_search_redirect", {
				zip: normalized,
				utility,
				redirectUrl: finalUrl,
			});
			onResultEvent({
				result: { redirectUrl: finalUrl },
				zip: normalized,
				utility,
			});
		},
		[onResultEvent, zip],
	);

	// Utility-selection modal path: rebase to the zip funnel and dispatch. No
	// plan-reveal — a multi-utility zip is not a single deregulated result.
	const emitRedirect = useCallback(
		(redirectUrl: string, utility?: string) => {
			dispatchRedirect(rebaseToZipFunnel(redirectUrl), utility);
		},
		[dispatchRedirect],
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
		// Single-utility result: rebase to the zip funnel, then for a deregulated
		// (Oncor/CenterPoint) zip in the test arm divert to /plan-reveal carrying
		// the funnel URL as `next`; control / ineligible stay on it.
		const next = rebaseToZipFunnel(result.data.redirectUrl);
		dispatchRedirect(
			maybeWrapInPlanReveal({ utility: strategy.utility, next }),
			strategy.utility,
		);
	}, [zip, loading, dispatchRedirect, onErrorEvent]);

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
				{!loading && <CtaButton title={cta} onClick={submit} />}
			</div>

			{error && (
				<p className={cx(styles.energyFormInputErrorText, styles.zipErrorText)}>
					{error}
				</p>
			)}

			{!loading && (
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
