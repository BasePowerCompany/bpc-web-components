// Destination for the energy-only zip arms (eo_zip_entry_0813).
//
// Built here rather than fetched from the zip router on purpose. That router
// answers off address_routing/data/zip_routing.json, which is the *battery*
// footprint: 1,542 zips covering ONCOR, CENTERPOINT, COMMONWEALTH_EDISON,
// AUSTIN_ENERGY, FARMERS, COSERV, GVEC, EL_PASO_ELECTRIC and two co-ops, with
// zero AEP and zero TNMP rows. Routing energy-only zips through it would
// waitlist every AEP and TNMP zip in Texas — most of the energy-only market.
//
// The origin is pinned: the funnel lives on the join host while these arms
// render on www, so this is an origin swap, not the pathname swap the
// same-origin markets use in ./zipFunnel.

const ENERGY_FUNNEL_ORIGIN = "https://join.basepowercompany.com";

// One route per arm: t1 reveals a plan, t2 reveals a rate calculator. Both are
// zip-scoped, so neither takes an external_address_id.
const ENERGY_ARM_ROUTES = {
	t1: "/join-energy-plan",
	t2: "/join-energy-calculator",
} as const;

/**
 * Funnel URL for an energy zip arm. `utility` is optional because a zip alone
 * cannot always name one: ~90 of the 1,358 zips in `public.utility_lookup`
 * straddle a TDSP boundary. Omitting it is the deliberate fallback — the reveal
 * screen renders a utility-agnostic rate and records `reason: "unknown_utility"`,
 * so the gap is measurable rather than silent.
 */
export function energyFunnelUrl(params: {
	arm: "t1" | "t2";
	zip: string;
	utility?: string;
}): string {
	const url = new URL(ENERGY_ARM_ROUTES[params.arm], ENERGY_FUNNEL_ORIGIN);
	url.searchParams.set("postal_code", params.zip);
	if (params.utility) url.searchParams.set("utility", params.utility);
	return url.toString();
}
