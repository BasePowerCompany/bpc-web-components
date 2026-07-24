/**
 * Plan-reveal experiment (address mode only). Deregulated (Oncor / CenterPoint)
 * addresses in the test arm are diverted to an offer interstitial before the
 * funnel; the hypothesis is that the upfront reveal lifts funnel conversion.
 * Control / ineligible users continue straight to the funnel as today.
 *
 * The page (base-marketing-website, PR #542) reads `utility` + `next` (the
 * decorated funnel URL) and, on Continue, forwards to `next`. This mirrors zip
 * mode's zipFunnel.ts: a small pure transform applied once at redirect time.
 *
 * NOTE — before launch:
 *   • Confirm PLAN_REVEAL_URL's production origin.
 *   • /plan-reveal is currently `preview` / `productionEnabled: false` in
 *     base-marketing-website; it must be enabled in production.
 *   • The host embed script may re-decorate the OUTER plan-reveal URL — that's
 *     harmless; `next` is already decorated here.
 */

import { decorateRedirectUrl } from "@/address-search/decorateRedirectUrl";
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
 * For a deregulated address-mode user in the test arm, returns the
 * `/plan-reveal?utility=&next=<decorated funnel url>&city=` URL to redirect to.
 * Otherwise returns `redirectUrl` unchanged (control / ineligible / flag off /
 * utility absent — e.g. a backend that doesn't yet return `utility`).
 *
 * Eligibility (deregulated utility) is checked BEFORE the flag read, so the
 * exposure that `resolvePlanRevealArm` records is scoped to the eligible
 * population only.
 */
export function maybeRedirectToPlanReveal(params: {
	utility: string | undefined;
	redirectUrl: string;
	externalId?: string;
	city?: string;
}): string {
	const utility = normalizeDeregulatedUtility(params.utility);
	if (!utility) return params.redirectUrl;
	if (resolvePlanRevealArm() !== "test") return params.redirectUrl;

	const next = decorateRedirectUrl(params.redirectUrl, params.externalId);
	const url = new URL(PLAN_REVEAL_URL);
	url.searchParams.set("utility", utility);
	url.searchParams.set("next", next);
	if (params.city) url.searchParams.set("city", params.city);
	return url.toString();
}
