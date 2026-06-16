import { posthogGetFeatureFlag } from "@/address-search/utils";

/**
 * Centralizes PostHog experiment definitions and their per-experiment
 * eligibility / variant-resolution logic. Each experiment owns its flag key,
 * variant constants, an eligibility check, and a resolver that reads the flag
 * and produces the experiment's effect.
 *
 * Read the flag (via the resolver) only after the eligibility check passes, so
 * `$feature_flag_called` exposures stay limited to eligible users.
 */

// --- dereg_funnel_parity_test --------------------------------------------
// Route eligible deregulated, battery (non-energy-only) addresses to the new
// lead funnel app instead of the existing /join-now flow. Eligible addresses
// resolve to exactly the "/join-now" path (DEREG serving single-result) from
// /api/address-router.
const DEREG_FUNNEL_PARITY_TEST_FLAG = "dereg_funnel_parity_test";
const DEREG_FUNNEL_PARITY_TEST_VARIANT = "test";
const DEREG_FUNNEL_CONTROL_VARIANT = "control";
const DEREG_FUNNEL_ELIGIBLE_PATH = "/join-now";
const DEREG_FUNNEL_ORIGIN = "https://join.basepowercompany.com";

/**
 * Eligible when the address is non-energy-only and the router resolved it to
 * the deregulated-serving "/join-now" path. Pure — safe to call before reading
 * any feature flag.
 */
export function checkDeregFunnelParityTestEligibility(
	isEnergyOnly: boolean,
	redirectUrl: string,
): boolean {
	if (isEnergyOnly) return false;
	return (
		new URL(redirectUrl, window.location.origin).pathname ===
		DEREG_FUNNEL_ELIGIBLE_PATH
	);
}

/**
 * Resolve the experiment for an eligible address: reads the variant (recording
 * the exposure) and, for the test variant, rebases the redirect onto the funnel
 * origin with `external_id` added. Only the path + query are rebased so the
 * swap holds even if the backend ever returns an absolute redirect URL.
 *
 * Call only after `checkDeregFunnelParityTestEligibility` passes. `variant` is
 * normalized to "control" when the user is unbucketed (PostHog returns `false`
 * / `undefined`).
 */
export function resolveDeregFunnelParityTest(
	redirectUrl: string,
	externalId: string,
): { variant: string; redirectUrl: string } {
	const raw = posthogGetFeatureFlag(DEREG_FUNNEL_PARITY_TEST_FLAG);
	const variant = typeof raw === "string" ? raw : DEREG_FUNNEL_CONTROL_VARIANT;

	if (variant !== DEREG_FUNNEL_PARITY_TEST_VARIANT) {
		return { variant, redirectUrl };
	}

	const source = new URL(redirectUrl, window.location.origin);
	const funnelUrl = new URL(
		source.pathname + source.search,
		DEREG_FUNNEL_ORIGIN,
	);
	funnelUrl.searchParams.set("external_id", externalId);
	return { variant, redirectUrl: funnelUrl.toString() };
}
