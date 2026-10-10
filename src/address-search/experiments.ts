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
 * `resolveZipEntryComedArm` (below) is the reference implementation.
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

// The address entry has no CTA default of its own (Autocomplete gates the button
// on a truthy cta), so mode="zip-comed" supplies one rather than letting a host
// that omits `cta` leave the control arm the only arm without a button.
const COMED_ADDRESS_ARM_CTA = "See if your home qualifies";

/**
 * Which CTA label each zip-comed arm renders. Every entry honors the host's
 * `cta`; the zip-comed address arm alone gets a fallback, because the address
 * entry has no default of its own and would otherwise render no button. The zip
 * entry's default lives in ZipSearchApp, which `undefined` falls through to.
 */
export function ctaForComedArm(
	entry: "zip" | "address",
	isZipComedMode: boolean,
	hostCta: string | undefined,
): string | undefined {
	if (isZipComedMode && entry === "address") {
		return hostCta ?? COMED_ADDRESS_ARM_CTA;
	}
	return hostCta;
}
