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

import { ZIP_ENTRY_ENERGY_FLAG } from "@/address-search/experiments";

const ENERGY_FUNNEL_ORIGIN = "https://join.basepowercompany.com";

// The waitlist is a marketing page, so it sits on www rather than the join host.
const ENERGY_WAITLIST_ORIGIN = "https://www.basepowercompany.com";
const ENERGY_WAITLIST_PATH = "/energy-soon";

// One route per arm: t1 reveals a plan, t2 reveals a rate calculator. Both are
// zip-scoped, so neither takes an external_address_id.
const ENERGY_ARM_ROUTES = {
	t1: "/join-energy-plan",
	t2: "/join-energy-calculator",
} as const;

const EXPERIMENT_FLAG_PARAM = "experiment_flag";

// `<flagKey>:<variant>`, matching what marketing-ui emits for the dereg test.
// Not a UTM, so decorateRedirectUrl does not carry it — it is set here.
const armFlagValue = (arm: "t1" | "t2" | "control") =>
	`${ZIP_ENTRY_ENERGY_FLAG}:${arm}`;

// Every destination this experiment emits carries its arm, the waitlist included:
// a visitor who never reaches the funnel is otherwise unattributable to an arm,
// and the waitlist rate per arm is exactly what tells the two apart.
function stampArm(url: URL, arm: "t1" | "t2"): void {
	url.searchParams.set(EXPERIMENT_FLAG_PARAM, armFlagValue(arm));
}

/**
 * `experiment_flag` for the redirect the *address* path emits, or undefined to
 * leave that redirect exactly as it is today. Checkout turns this param into a
 * HubSpot property the same way for every arm, so control has to carry its arm
 * too — the treatments build their own stamped URLs above, and an unstamped
 * control would reach HubSpot with no arm and make the treatments look like
 * they own every conversion.
 *
 * Only `control` qualifies. `unassigned` fired no exposure — flag off, PostHog
 * absent, or the gate timed out — so stamping it would put people in HubSpot's
 * arm population that the PostHog denominator never counted. Every other mode
 * is outside this experiment and keeps its URL byte for byte.
 */
export function energyControlExperimentFlag(
	isZipEnergyMode: boolean,
	arm: "t1" | "t2" | "control" | "unassigned" | undefined,
): string | undefined {
	if (!isZipEnergyMode || arm !== "control") return undefined;
	return armFlagValue("control");
}

/**
 * Set `flag` on an already-built redirect URL, or hand the URL back untouched
 * when there is no flag to set. Takes the absolute URL decorateRedirectUrl
 * returns; an unparseable one passes through rather than breaking the
 * navigation, as it does there.
 */
export function stampExperimentFlag(
	redirectUrl: string,
	flag: string | undefined,
): string {
	if (!flag) return redirectUrl;
	try {
		const url = new URL(redirectUrl);
		url.searchParams.set(EXPERIMENT_FLAG_PARAM, flag);
		return url.toString();
	} catch {
		return redirectUrl;
	}
}

/**
 * Funnel URL for an energy zip arm. `utility` is optional because a zip alone
 * cannot always name one: ~90 of the 1,358 zips in `public.utility_lookup`
 * straddle a TDSP boundary. Omitting it is the deliberate fallback — the reveal
 * screen renders a utility-agnostic rate and records `reason: "unknown_utility"`,
 * so the gap is measurable rather than silent.
 *
 * The arm is stamped as `experiment_flag` here, in the sole builder, so no
 * caller can emit an unstamped URL. Nothing else records which arm a visitor
 * was in: these flows write no lead.
 */
export function energyFunnelUrl(params: {
	arm: "t1" | "t2";
	zip: string;
	utility?: string;
}): string {
	const url = new URL(ENERGY_ARM_ROUTES[params.arm], ENERGY_FUNNEL_ORIGIN);
	url.searchParams.set("postal_code", params.zip);
	if (params.utility) url.searchParams.set("utility", params.utility);
	stampArm(url, params.arm);
	return url.toString();
}

/**
 * Waitlist destination for a zip the energy-only footprint does not serve.
 *
 * Reserved for a *successful* lookup that returned no utilities. A failed lookup
 * means the market is unknown, not unserved, and must continue into the arm
 * instead — waitlisting on a timeout would tell a serviceable visitor we do not
 * serve them.
 */
export function energyWaitlistUrl(params: {
	arm: "t1" | "t2";
	zip: string;
}): string {
	const url = new URL(ENERGY_WAITLIST_PATH, ENERGY_WAITLIST_ORIGIN);
	url.searchParams.set("postal_code", params.zip);
	stampArm(url, params.arm);
	return url.toString();
}
