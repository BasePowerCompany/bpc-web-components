import { posthogGetFeatureFlag } from "@/address-search/utils";

/**
 * zip_entry_test_0701 — zip-first funnel entry experiment.
 *
 * Elements with `mode="zip"` are the experiment surface: the flag decides
 * which entry the visitor actually sees. `test` renders the zip entry;
 * `control` and unbucketed visitors (flag off / not yet rolled out / PostHog
 * unavailable) keep the standard address entry.
 *
 * Reading the flag records the experiment exposure ($feature_flag_called), so
 * resolve only after PostHog's flags have loaded and only on zip-mode elements.
 * For QA, force an arm with PostHog's own override tooling
 * (posthog.featureFlags.overrideFeatureFlags / the toolbar).
 */
const ZIP_ENTRY_TEST_FLAG = "zip_entry_test_0701";
const ZIP_ENTRY_TEST_VARIANT = "test";
const ZIP_ENTRY_CONTROL_VARIANT = "control";

export function resolveZipEntryArm(): "zip" | "address" {
	// Peek without sending $feature_flag_called: unbucketed visitors (flag off /
	// outside the rollout %) must not log an exposure at all.
	const variant = posthogGetFeatureFlag(ZIP_ENTRY_TEST_FLAG, {
		send_event: false,
	});
	if (
		variant !== ZIP_ENTRY_TEST_VARIANT &&
		variant !== ZIP_ENTRY_CONTROL_VARIANT
	) {
		return "address";
	}

	// Bucketed (test or control): re-read with the event enabled so posthog-js
	// records the exposure ($feature_flag_called) exactly when the assigned arm
	// renders. posthog-js dedupes repeat calls for the same flag+value.
	posthogGetFeatureFlag(ZIP_ENTRY_TEST_FLAG);
	return variant === ZIP_ENTRY_TEST_VARIANT ? "zip" : "address";
}

/**
 * Run `callback` once PostHog's feature flags have loaded (immediately if they
 * already have). Returns `false` when PostHog isn't on the page, so callers
 * can fall back without waiting.
 */
export const posthogOnFeatureFlags = (callback: () => void): boolean => {
	if (!window.posthog?.onFeatureFlags) return false;
	window.posthog.onFeatureFlags(callback);
	return true;
};
