/**
 * Client-side redirect-URL decoration, mirroring the host embed script's
 * `result` listener (the Webflow embed appends these before navigating).
 *
 * The component decorates every address redirect at the call site (see
 * AddressSearchApp) so the component is the single source of truth for the
 * funnel URL — control and the plan-reveal `next` share one decoration path and
 * can't drift. A host that also decorates (the current Webflow embed) simply
 * re-applies the same params idempotently. Keep this in sync with the embed
 * script's UTM_KEYS + base_vid / person_id / external_id logic until the hosts
 * drop their own decoration.
 *
 * All cookie / localStorage / posthog access is guarded — any unavailable source
 * is simply skipped. This is client-only embed code, so `window` always exists.
 */

// UTM / referral keys persisted through the funnel handoff. Mirrors the embed script.
const UTM_KEYS = [
	"gclid",
	"fbclid",
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"referrer_name",
	"promo_code",
	"heard_from",
	"referral_plan",
	"sci_id",
	"awc",
	"ttclid",
] as const;

function getCookie(name: string): string | null {
	try {
		const encoded = `${encodeURIComponent(name)}=`;
		const parts = document.cookie ? document.cookie.split("; ") : [];
		for (const part of parts) {
			if (part.startsWith(encoded)) {
				return decodeURIComponent(part.slice(encoded.length));
			}
		}
	} catch {
		// document.cookie can throw in sandboxed contexts; treat as absent.
	}
	return null;
}

function isValidVid(v: unknown): v is string {
	return (
		typeof v === "string" &&
		v.trim() !== "" &&
		v !== "null" &&
		v !== "undefined"
	);
}

// base_vid: cookie (works in iOS in-app browsers) → localStorage → URL param.
function getBaseVid(): string | null {
	const ck = getCookie("base_vid");
	if (isValidVid(ck)) return ck;
	try {
		const ls = localStorage.getItem("base_vid");
		if (isValidVid(ls)) return ls;
	} catch {
		// localStorage unavailable (privacy mode); skip.
	}
	try {
		const urlVid = new URLSearchParams(window.location.search).get("base_vid");
		if (isValidVid(urlVid)) return urlVid;
	} catch {
		// ignore malformed location.search
	}
	return null;
}

// Merge persisted UTM/referral params, lowest → highest priority so the most
// recent click (URL) wins: cookies → localStorage `urchin` → URL query.
function getStoredUtmParams(): Record<string, string> {
	const merged: Record<string, string> = {};

	for (const k of UTM_KEYS) {
		const v = getCookie(k);
		if (v) merged[k] = v;
	}

	try {
		const stored = JSON.parse(localStorage.getItem("urchin") || "{}");
		for (const [k, v] of Object.entries(stored)) {
			if (
				(UTM_KEYS as readonly string[]).includes(k) &&
				typeof v === "string" &&
				v
			) {
				merged[k] = v;
			}
		}
	} catch {
		// missing / malformed `urchin`; skip.
	}

	try {
		const urlParams = new URLSearchParams(window.location.search);
		for (const k of UTM_KEYS) {
			const v = urlParams.get(k);
			if (v) merged[k] = v;
		}
	} catch {
		// ignore malformed location.search
	}

	return merged;
}

/**
 * Append persisted UTM/referral params, `base_vid`, `person_id`, and
 * `external_id` to `redirectUrl`, returning the decorated absolute URL. On a
 * parse failure the input is returned unchanged.
 */
export function decorateRedirectUrl(
	redirectUrl: string,
	externalId?: string,
): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}

	const stored = getStoredUtmParams();
	for (const k of UTM_KEYS) {
		if (stored[k]) url.searchParams.set(k, stored[k]);
	}

	const baseVid = getBaseVid();
	if (baseVid) url.searchParams.set("base_vid", baseVid);

	try {
		const personId = window.posthog?.get_distinct_id?.();
		if (personId) url.searchParams.set("person_id", personId);
	} catch {
		// posthog not ready; skip person_id.
	}

	if (externalId) url.searchParams.set("external_id", externalId);

	return url.toString();
}
