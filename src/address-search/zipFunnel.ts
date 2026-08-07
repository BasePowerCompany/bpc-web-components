// The backend returns each market's canonical funnel URL; zip mode rewrites that
// to the zip route here, before dispatching the redirect.
//
// Both markets are unconditional: anyone who reached a zip entry belongs on the
// zip route, so a zip typed into any zip widget rebases. The ComEd experiment
// still decides whether the zip entry renders at all — not where it sends you.
const DEREGULATED_CANONICAL_PATH = "/join-now";
const DEREGULATED_ZIP_PATH = "/join-now-zip";

// ComEd crosses origins (www → join host), so it can't be TX's pathname swap.
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

	if (url.pathname !== DEREGULATED_CANONICAL_PATH) {
		return redirectUrl;
	}
	url.pathname = DEREGULATED_ZIP_PATH;
	return url.toString();
}
