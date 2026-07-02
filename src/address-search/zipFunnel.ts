/**
 * The backend stays experiment-agnostic: zip routing returns the canonical
 * funnel URL (DEREG serving → https://join.basepowercompany.com/join-now).
 * Zip mode IS the zip-first test arm (assignment lives outside the component,
 * via the `mode` attribute), so the /join-now → /join-now-zip override is
 * applied here, deterministically, before the redirect is dispatched. Every
 * other destination (farmers/gvec/waitlist/…) passes through untouched.
 */
const CANONICAL_FUNNEL_PATH = "/join-now";
const ZIP_FUNNEL_PATH = "/join-now-zip";

export function rebaseToZipFunnel(redirectUrl: string): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}
	if (url.pathname !== CANONICAL_FUNNEL_PATH) {
		return redirectUrl;
	}
	url.pathname = ZIP_FUNNEL_PATH;
	return url.toString();
}
