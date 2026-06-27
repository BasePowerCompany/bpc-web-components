/**
 * Routing logic for deregulated, battery (non-energy-only) addresses: eligible
 * addresses are sent to the new lead funnel app instead of the existing
 * /join-now flow. Eligible addresses resolve to exactly the "/join-now" path
 * (DEREG serving single-result) from /api/address-router.
 *
 * This shipped out of the concluded `dereg_funnel_parity_test` experiment; the
 * funnel (test variant) is now the permanent behavior for all eligible
 * addresses.
 */
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
 * Rebase an eligible redirect onto the funnel origin, adding `external_id`.
 * Only the path + query are rebased so the swap holds even if the backend ever
 * returns an absolute redirect URL.
 *
 * Call only after `checkDeregFunnelParityTestEligibility` passes.
 */
export function rebaseDeregFunnelRedirect(
	redirectUrl: string,
	externalId: string,
): string {
	const source = new URL(redirectUrl, window.location.origin);
	const funnelUrl = new URL(
		source.pathname + source.search,
		DEREG_FUNNEL_ORIGIN,
	);
	funnelUrl.searchParams.set("external_id", externalId);
	return funnelUrl.toString();
}
