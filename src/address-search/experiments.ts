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
 * Bucketed variants ("test" / "control") get an `experiment_flag=<flag>:<variant>`
 * query param appended to the redirect so downstream apps can read the
 * assignment. Unbucketed users (PostHog returns `false` / `undefined` — the flag
 * is a 50%-gated multivariate split, so half of eligible users fall outside it)
 * are left untouched and untagged, keeping the control-vs-test comparison clean.
 *
 * Call only after `checkDeregFunnelParityTestEligibility` passes. Returns
 * `variant: undefined` for unbucketed users.
 */
export function resolveDeregFunnelParityTest(
	redirectUrl: string,
	externalId: string,
): { variant: string | undefined; redirectUrl: string } {
	const variant = posthogGetFeatureFlag(DEREG_FUNNEL_PARITY_TEST_FLAG);

	// Unbucketed: not assigned a real variant. Leave the redirect untouched and
	// tag nothing.
	if (
		variant !== DEREG_FUNNEL_PARITY_TEST_VARIANT &&
		variant !== DEREG_FUNNEL_CONTROL_VARIANT
	) {
		return { variant: undefined, redirectUrl };
	}

	const source = new URL(redirectUrl, window.location.origin);
	source.searchParams.set(
		"experiment_flag",
		`${DEREG_FUNNEL_PARITY_TEST_FLAG}:${variant}`,
	);

	if (variant === DEREG_FUNNEL_PARITY_TEST_VARIANT) {
		const funnelUrl = new URL(
			source.pathname + source.search,
			DEREG_FUNNEL_ORIGIN,
		);
		funnelUrl.searchParams.set("external_id", externalId);
		return { variant, redirectUrl: funnelUrl.toString() };
	}

	// Control: keep the existing relative /join-now redirect, annotated with the
	// experiment_flag param.
	return { variant, redirectUrl: source.pathname + source.search };
}
