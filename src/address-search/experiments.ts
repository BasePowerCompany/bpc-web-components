/**
 * PostHog experiment helpers for the bpc-address-search element.
 *
 * ── How to set up an experiment-gated arm ──────────────────────────────────
 *
 * An experiment lives behind a PostHog feature flag whose variant decides which
 * UI a visitor sees. To add one:
 *
 *  1. Write a resolver that reads the flag and maps its variant to a UI arm.
 *     Read the flag with `posthogGetFeatureFlag` (from ./utils); treat
 *     `undefined` (PostHog absent / flag off / not yet loaded) and any
 *     unexpected variant as the control/default arm.
 *  2. Gate the render in `element.tsx`: wait for flags with
 *     `posthogOnFeatureFlags` (below), then call the resolver — only on the
 *     element that opts into the experiment, so reading the flag records the
 *     `$feature_flag_called` exposure for eligible visitors only.
 *
 * The concluded `zip_entry_test_0701` experiment resolved like this (kept as a
 * reference for the next one — remove/replace when you add a real resolver):
 *
 *     import { posthogGetFeatureFlag } from "@/address-search/utils";
 *
 *     const ZIP_ENTRY_TEST_FLAG = "zip_entry_test_0701";
 *     const ZIP_ENTRY_TEST_VARIANT = "test";
 *
 *     export function resolveZipEntryArm(): "zip" | "address" {
 *       return posthogGetFeatureFlag(ZIP_ENTRY_TEST_FLAG) === ZIP_ENTRY_TEST_VARIANT
 *         ? "zip"
 *         : "address";
 *     }
 *
 * ───────────────────────────────────────────────────────────────────────────
 */

import { posthogGetFeatureFlag } from "@/address-search/utils";

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

const PLAN_REVEAL_TEST_FLAG = "plan_reveal_test_0723";
const PLAN_REVEAL_TEST_VARIANT = "test";

/**
 * Plan-reveal experiment arm (see ./planReveal). Reading the flag records the
 * `$feature_flag_called` exposure, so call this ONLY at divert time for an
 * already-known-eligible (deregulated address-mode) user — never at mount — so
 * exposure stays scoped to the eligible population. `undefined` (PostHog absent
 * / flag off / not yet loaded) and any other variant are treated as control.
 */
export function resolvePlanRevealArm(): "test" | "control" {
	return posthogGetFeatureFlag(PLAN_REVEAL_TEST_FLAG) ===
		PLAN_REVEAL_TEST_VARIANT
		? "test"
		: "control";
}
