/**
 * The backend stays experiment-agnostic: zip routing returns the canonical
 * funnel URL for the visitor's market. Zip mode IS the zip-first test arm
 * (assignment lives outside the component, via the `mode` attribute), so the
 * canonical → zip-first override is applied here, deterministically, before the
 * redirect is dispatched. Every other destination (farmers/gvec/waitlist/…)
 * passes through untouched.
 *
 * The two markets need different rewrites, so they are not one table:
 *
 *  - Deregulated (TX) stays on the same host (join.basepowercompany.com), so it
 *    is a pathname swap and deliberately origin-agnostic — a relative
 *    `/join-now` must rebase too, and pinning an origin would silently drop the
 *    zip arm on any host but one.
 *  - ComEd/Illinois is a regulated market with a retail-choice carve-out whose
 *    canonical funnel is served from www, while its zip arm lives on the join
 *    host — so it crosses origins and cannot be a pathname swap. Matched on
 *    pathname alone for the same reason as above (staging hosts included).
 *
 * Both carry the query string and fragment across untouched.
 */
const DEREGULATED_CANONICAL_PATH = "/join-now";
const DEREGULATED_ZIP_PATH = "/join-now-zip";

const COMED_CANONICAL_PATH = "/illinois/join";
const COMED_ZIP_URL = "https://join.basepowercompany.com/illinois/join-zip";

export function rebaseToZipFunnel(redirectUrl: string): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}

	if (url.pathname === COMED_CANONICAL_PATH) {
		const rebased = new URL(COMED_ZIP_URL);
		rebased.search = url.search;
		rebased.hash = url.hash;
		return rebased.toString();
	}

	if (url.pathname !== DEREGULATED_CANONICAL_PATH) {
		return redirectUrl;
	}
	url.pathname = DEREGULATED_ZIP_PATH;
	return url.toString();
}
