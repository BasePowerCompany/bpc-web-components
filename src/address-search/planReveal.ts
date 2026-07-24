/**
 * Plan-reveal experiment (address mode only). Deregulated (Oncor / CenterPoint)
 * addresses in the test arm are diverted to an offer interstitial before the
 * funnel; the hypothesis is that the upfront reveal lifts funnel conversion.
 * Control / ineligible users continue straight to the funnel as today.
 *
 * The page (base-marketing-website, PR #542) reads `utility` + `next` and, on
 * Continue, forwards to `next`. This wraps an ALREADY-decorated funnel URL: the
 * component decorates every address redirect at the call site (single source of
 * truth — see AddressSearchApp), so `next` and the control URL share one
 * decoration path and can't drift. This mirrors zip mode's zipFunnel.ts: a small
 * pure transform applied once at redirect time.
 *
 * NOTE — before launch:
 *   • Confirm PLAN_REVEAL_URL's production origin.
 *   • /plan-reveal is currently `preview` / `productionEnabled: false` in
 *     base-marketing-website; it must be enabled in production.
 *   • A host embed script that also decorates will re-decorate the OUTER
 *     plan-reveal URL — that's harmless; `next` is already decorated.
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
 * For a deregulated address-mode user in the test arm, wraps the (already
 * decorated) funnel URL `next` into a
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
