/**
 * Plan-reveal experiment. Deregulated (Oncor / CenterPoint) single-utility
 * results — from either address or zip entry — in the test arm are diverted to
 * an offer interstitial before the funnel; the hypothesis is that the upfront
 * reveal lifts funnel conversion. Control / ineligible users continue straight
 * to the funnel as today.
 *
 * The page (base-marketing-website, PR #542) reads `utility` + `next` and, on
 * Continue, forwards to `next`. This is a small pure transform applied once at
 * redirect time, mirroring zip mode's zipFunnel.ts.
 *
 * NOTE — before launch:
 *   • Confirm PLAN_REVEAL_URL's production origin.
 *   • /plan-reveal is currently `preview` / `productionEnabled: false` in
 *     base-marketing-website; it must be enabled in production.
 *   • `next` is not decorated with UTM/attribution params here (decoration is
 *     handled via a coordinated base-marketing-website change); the interstitial
 *     must forward those from its own URL to `next` on Continue.
 */

import { resolvePlanRevealArm } from "@/address-search/experiments";

// Confirm the production origin before launch.
const PLAN_REVEAL_URL = "https://www.basepowercompany.com/plan-reveal";

// The only deregulated TDSPs with a battery offer + a /plan-reveal entry.
const DEREGULATED_UTILITIES = new Set(["ONCOR", "CENTERPOINT"]);

/** Uppercased utility if it's an eligible deregulated TDSP, else undefined. */
function normalizeDeregulatedUtility(
	utility: string | undefined,
): string | undefined {
	const u = utility?.trim().toUpperCase();
	return u && DEREGULATED_UTILITIES.has(u) ? u : undefined;
}

/**
 * For a deregulated user in the test arm, wraps the funnel URL `next` into a
 * `/plan-reveal?utility=&next=<next>&city=` URL. Otherwise returns `next`
 * unchanged (control / ineligible / flag off / utility absent — e.g. a backend
 * that doesn't yet return `utility`).
 *
 * Eligibility (deregulated utility) is checked BEFORE the flag read, so the
 * exposure that `resolvePlanRevealArm` records is scoped to the eligible
 * population only.
 */
export function maybeWrapInPlanReveal(params: {
	utility: string | undefined;
	next: string;
	city?: string;
}): string {
	const utility = normalizeDeregulatedUtility(params.utility);
	if (!utility) return params.next;
	if (resolvePlanRevealArm() !== "test") return params.next;

	const url = new URL(PLAN_REVEAL_URL);
	url.searchParams.set("utility", utility);
	url.searchParams.set("next", params.next);
	if (params.city) url.searchParams.set("city", params.city);
	return url.toString();
}
