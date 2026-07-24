// Plan-reveal experiment: deregulated (Oncor/CenterPoint) single-utility results
// in the test arm divert to an offer interstitial before the funnel; control and
// ineligible users go straight through. Pure transform applied once at redirect.
//
// Pre-launch: confirm PLAN_REVEAL_URL's prod origin and enable /plan-reveal in
// base-marketing-website (currently productionEnabled:false). `next` is not
// decorated here — the interstitial must forward UTM/attribution from its own URL.

import { DEREGULATED_UTILITIES } from "@/address-search/deregulatedUtilities";
import { resolvePlanRevealArm } from "@/address-search/experiments";

const PLAN_REVEAL_URL = "https://www.basepowercompany.com/plan-reveal";

// Utilities that divert to /plan-reveal: the canonical deregulated TDSPs plus a
// TEMPORARY "DEREG" backward-compat shim — the router still returns the legacy
// "DEREG" value until base-monorepo #31109 (TDSP swap) deploys. Scoped here on
// purpose: the canonical set stays ONCOR/CENTERPOINT per #75. Drop "DEREG" once
// the server deploy finishes.
const PLAN_REVEAL_UTILITIES = new Set([...DEREGULATED_UTILITIES, "DEREG"]);

// Uppercased utility if it's eligible for the /plan-reveal divert, else undefined.
function normalizePlanRevealUtility(
	utility: string | undefined,
): string | undefined {
	const u = utility?.trim().toUpperCase();
	return u && PLAN_REVEAL_UTILITIES.has(u) ? u : undefined;
}

// Test-arm deregulated users get `next` wrapped into /plan-reveal; everyone else passes through. Eligibility is checked before the flag read so exposure stays scoped to the eligible population.
export function maybeWrapInPlanReveal(params: {
	utility: string | undefined;
	next: string;
	city?: string;
}): string {
	const utility = normalizePlanRevealUtility(params.utility);
	if (!utility) return params.next;
	if (resolvePlanRevealArm() !== "test") return params.next;

	const url = new URL(PLAN_REVEAL_URL);
	url.searchParams.set("utility", utility);
	url.searchParams.set("next", params.next);
	if (params.city) url.searchParams.set("city", params.city);
	return url.toString();
}
