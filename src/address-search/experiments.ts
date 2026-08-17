/**
 * PostHog experiment helpers for the bpc-address-search element.
 *
 * ── How to set up an experiment-gated arm ──────────────────────────────────
 *
 * An experiment lives behind a PostHog feature flag whose variant decides which
 * UI a visitor sees. To add one:
 *
 *  1. Write a resolver that reads the flag and maps its variant to a UI arm.
 *     Read it with `posthogGetFeatureFlag(key, { send_event: false })` so the
 *     built-in exposure stays off, and treat `undefined` (PostHog absent / flag
 *     off / not yet loaded) and any unexpected variant as the default arm.
 *  2. Record the exposure with `captureExposure` (below) — never by capturing
 *     `$feature_flag_called` yourself. Call it only once the visitor is known
 *     eligible AND assigned a real variant, so the denominator is the
 *     population the experiment can actually affect. A test asserts this file
 *     is the only place that emits the event.
 *  3. Gate the render or the divert: for render-time arms, wait for flags with
 *     `posthogOnFeatureFlags` (below) and resolve only on the element that opts
 *     into the experiment. For navigation-time arms, resolve at divert time.
 *
 * `resolvePlanRevealArm` (below) is the reference implementation.
 *
 * ───────────────────────────────────────────────────────────────────────────
 */

import { posthogCapture, posthogGetFeatureFlag } from "@/address-search/utils";

/**
 * Run `callback` once PostHog's feature flags have loaded (immediately if they
 * already have). Returns `false` when PostHog isn't on the page, so callers
 * can fall back without waiting.
 */
export const posthogOnFeatureFlags = (callback: () => void): boolean => {
	if (!window.posthog?.onFeatureFlags) return false;
	window.posthog.onFeatureFlags(callback);
	return true;
};

/**
 * Record an experiment exposure.
 *
 * ALWAYS use this instead of capturing `$feature_flag_called` by hand. An arm
 * that changes where the user goes fires its exposure microseconds before the
 * page unloads, so the default batched queue loses it — and because only the
 * diverting arm navigates, the loss is one-sided and shows up as a sample-ratio
 * mismatch rather than as missing volume. `send_instantly` skips the batch and
 * `sendBeacon` is the transport that survives unload.
 *
 * Pair it with `getFeatureFlag(key, { send_event: false })` and call it only
 * once the visitor is known eligible and assigned, so the exposure denominator
 * stays the population the experiment can actually affect.
 */
export function captureExposure(flagKey: string, variant: string): void {
	posthogCapture(
		"$feature_flag_called",
		{ $feature_flag: flagKey, $feature_flag_response: variant },
		{ send_instantly: true, transport: "sendBeacon" },
	);
}

const PLAN_REVEAL_TEST_FLAG = "dereg_plan_reveal_0724";

/**
 * Plan-reveal experiment arm (see ./planReveal). Reads the flag WITHOUT sending
 * the built-in exposure, then records `$feature_flag_called` only for a user
 * actually assigned a variant — a user outside the rollout population
 * (`unassigned`) logs no exposure. Call this ONLY at divert time for an
 * already-known-eligible (deregulated) user so exposure stays scoped to the
 * eligible, assigned population.
 *
 */
export function resolvePlanRevealArm(): "test" | "control" | "unassigned" {
	const variant = posthogGetFeatureFlag(PLAN_REVEAL_TEST_FLAG, {
		send_event: false,
	});
	if (variant !== "test" && variant !== "control") return "unassigned";
	captureExposure(PLAN_REVEAL_TEST_FLAG, variant);
	return variant;
}

export const ZIP_ENTRY_COMED_FLAG = "zip_entry_comed_0803";

/**
 * ComEd/Illinois zip-entry arm. Render-time, so call it only behind element.tsx's
 * flag gate; `control` and `unassigned` both keep the address entry.
 */
export function resolveZipEntryComedArm(): "test" | "control" | "unassigned" {
	const variant = posthogGetFeatureFlag(ZIP_ENTRY_COMED_FLAG, {
		send_event: false,
	});
	if (variant !== "test" && variant !== "control") return "unassigned";
	captureExposure(ZIP_ENTRY_COMED_FLAG, variant);
	return variant;
}

export const ZIP_ENTRY_ENERGY_FLAG = "eo_zip_entry_0813";

/**
 * Energy-only zip-entry arms. Render-time, so call it only behind element.tsx's
 * flag gate; `control` and `unassigned` both keep the address entry. Unlike the
 * ComEd experiment the two test arms differ in destination as well as entry —
 * see ./energyFunnel.
 */
export function resolveZipEntryEnergyArm():
	| "t1"
	| "t2"
	| "control"
	| "unassigned" {
	const variant = posthogGetFeatureFlag(ZIP_ENTRY_ENERGY_FLAG, {
		send_event: false,
	});
	if (variant !== "t1" && variant !== "t2" && variant !== "control") {
		return "unassigned";
	}
	captureExposure(ZIP_ENTRY_ENERGY_FLAG, variant);
	return variant;
}

// The address entry has no CTA default of its own (Autocomplete gates the button
// on a truthy cta), so mode="zip-comed" supplies one rather than letting a host
// that omits `cta` leave the control arm the only arm without a button.
const COMED_ADDRESS_ARM_CTA = "See if your home qualifies";

/**
 * Which CTA label each zip-comed arm renders. One `cta` attribute cannot carry
 * copy for both arms, so the zip arm keeps its own "Check Availability" default
 * and the host's value belongs to the address arm — and neither arm may end up
 * button-less, or CTA presence becomes a second variable the experiment never
 * meant to test. Every other embed is untouched: without `mode="zip-comed"` the
 * host's value passes through exactly as before, absent included.
 */
export function ctaForComedArm(
	entry: "zip" | "address",
	isZipComedMode: boolean,
	hostCta: string | undefined,
): string | undefined {
	if (!isZipComedMode) return hostCta;
	// undefined lets ZipSearchApp apply its own zip-appropriate default.
	if (entry === "zip") return undefined;
	return hostCta ?? COMED_ADDRESS_ARM_CTA;
}

// Each energy zip arm names what its own destination reveals, so the CTA is per
// arm rather than per entry. Kept a sibling of ctaForComedArm rather than folded
// into it: this is the second instance of the pattern, not yet a third.
const ENERGY_ARM_CTAS = {
	t1: "See my plan",
	t2: "Get my exact rate",
} as const;

/**
 * Which CTA label each eo_zip_entry_0813 arm renders. The two zip arms name
 * their own reveal; the address arms keep the host's label, so every
 * non-experiment embed and the control arm are untouched, absent `cta` included.
 */
export function ctaForEnergyArm(
	arm: "t1" | "t2" | "control" | "unassigned",
	hostCta: string | undefined,
): string | undefined {
	if (arm === "t1" || arm === "t2") return ENERGY_ARM_CTAS[arm];
	return hostCta;
}
