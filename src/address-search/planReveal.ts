// Plan-reveal experiment: deregulated (Oncor/CenterPoint) single-utility results
// in the test arm divert to an offer interstitial before the funnel; control and
// ineligible users go straight through. Pure transform applied once at redirect.
//
// Pre-launch: confirm PLAN_REVEAL_URL's prod origin and enable /plan-reveal in
// base-marketing-website (currently productionEnabled:false). `next` is not
// decorated here — the interstitial must forward UTM/attribution from its own URL.

import { resolvePlanRevealArm } from "@/address-search/experiments";

const PLAN_REVEAL_URL = "https://www.basepowercompany.com/plan-reveal";

// Deregulated TDSPs with a /plan-reveal entry. "DEREG" is a TEMPORARY pre-deploy shim — remove once base-monorepo PR #31109 (backend TDSP swap) deploys.
const DEREGULATED_UTILITIES = new Set(["ONCOR", "CENTERPOINT", "DEREG"]);

// Uppercased utility if it's an eligible deregulated TDSP, else undefined.
function normalizeDeregulatedUtility(
	utility: string | undefined,
): string | undefined {
	const u = utility?.trim().toUpperCase();
	return u && DEREGULATED_UTILITIES.has(u) ? u : undefined;
}

// Test-arm deregulated users get `next` wrapped into /plan-reveal; everyone else passes through. Eligibility is checked before the flag read so exposure stays scoped to the eligible population.
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
