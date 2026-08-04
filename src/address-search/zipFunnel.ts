// The backend returns each market's canonical funnel URL; zip mode IS the test
// arm, so it rewrites that to the zip route here, before dispatching the redirect.
const DEREGULATED_CANONICAL_PATH = "/join-now";
const DEREGULATED_ZIP_PATH = "/join-now-zip";

// Crosses origins (www → join host), so it can't be the pathname swap TX uses.
const COMED_CANONICAL_PATH = "/illinois/join";
const COMED_ZIP_URL = "https://join.basepowercompany.com/illinois/join-zip";

export function rebaseToZipFunnel(redirectUrl: string): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}

	// Pathname only, never origin: responses may be relative, and pinning an
	// origin would silently serve control on staging and apex hosts.
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
