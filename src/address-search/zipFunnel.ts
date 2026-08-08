// The backend returns each market's canonical funnel URL; zip mode rewrites that
// to the market's zip route here, before dispatching the redirect.
//
// Unconditional for every market with a live zip flow: anyone who reached a zip
// entry belongs on the zip route. The ComEd experiment still decides whether the
// zip entry renders at all — not where it sends you.
//
// An explicit table rather than a `/join` → `/join-zip` pattern: a market with no
// zip twin has to fall through untouched, and a pattern would silently rebase the
// next such market onto a 404. Adding a market here is a deliberate act.
const ZIP_ROUTES: Record<string, string> = {
	// ONCOR / CENTERPOINT / TNMP / AEP_CENTRAL / AEP_NORTH / DEREG
	"/join-now": "/join-now-zip",
	"/farmers/join": "/farmers/join-zip",
	"/austinenergy/join": "/austinenergy/join-zip",
	"/coserv/join": "/coserv/join-zip",
	"/gvec/join": "/gvec/join-zip",
	// UNKNOWN utility. A zip cannot answer serviceability, so the twin collects an
	// address — without it the record can never be re-checked when a market opens.
	"/join-waitlist": "/join-waitlist-zip",
};

// Deliberately absent from ZIP_ROUTES: /epelectric/waitlist (intake paused — the
// zip route is pinned to the waitlist, and epelectric/join-zip has nothing
// routing to it).

// ComEd crosses origins (www → join host), so it can't be the pathname swap the
// other markets use.
const COMED_CANONICAL_PATH = "/illinois/join";
const COMED_ZIP_URL = "https://join.basepowercompany.com/illinois/join-zip";

export function rebaseToZipFunnel(redirectUrl: string): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}

	// Match on pathname only: responses may be relative or come from any host, so
	// matching on origin would silently skip the rebase on staging and apex hosts.
	if (url.pathname === COMED_CANONICAL_PATH) {
		// The destination origin, unlike the match, is pinned: Illinois lives on the
		// join host, so this replaces the origin outright rather than swapping a path.
		const rebased = new URL(COMED_ZIP_URL);
		rebased.search = url.search;
		rebased.hash = url.hash;
		return rebased.toString();
	}

	// Pathname swap keeps whatever origin served the response, so a relative
	// response stays on the host the visitor is already on.
	const zipPath = ZIP_ROUTES[url.pathname];
	if (!zipPath) return redirectUrl;
	url.pathname = zipPath;
	return url.toString();
}
