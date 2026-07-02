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
 */
export const ZIP_ENTRY_TEST_FLAG = "zip_entry_test_0701";
const ZIP_ENTRY_TEST_VARIANT = "test";
const ZIP_ENTRY_CONTROL_VARIANT = "control";

// QA override: ?zip_entry_test=test|control forces an arm without reading the
// flag (no exposure recorded), so pre-rollout end-to-end testing on real pages
// doesn't pollute the experiment.
const ZIP_ENTRY_TEST_OVERRIDE_PARAM = "zip_entry_test";

export function resolveZipEntryArm(): "zip" | "address" {
	const override = new URLSearchParams(window.location.search).get(
		ZIP_ENTRY_TEST_OVERRIDE_PARAM,
	);
	if (override === ZIP_ENTRY_TEST_VARIANT) return "zip";
	if (override === ZIP_ENTRY_CONTROL_VARIANT) return "address";

	return posthogGetFeatureFlag(ZIP_ENTRY_TEST_FLAG) === ZIP_ENTRY_TEST_VARIANT
		? "zip"
		: "address";
}
