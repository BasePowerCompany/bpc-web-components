// The backend returns each market's canonical funnel URL; zip mode rewrites that
// to the zip route here, before dispatching the redirect.
//
// Texas is unconditional: /join-now-zip is the rolled-out destination for
// everyone, not an experiment arm.
const DEREGULATED_CANONICAL_PATH = "/join-now";
const DEREGULATED_ZIP_PATH = "/join-now-zip";

// ComEd crosses origins (www → join host), so it can't be TX's pathname swap.
// Opt-in per call: rewriting it unconditionally would divert an Illinois zip
// typed into any rolled-out zip widget onto the experiment's test destination,
// with no flag read and so no exposure.
const COMED_CANONICAL_PATH = "/illinois/join";
const COMED_ZIP_URL = "https://join.basepowercompany.com/illinois/join-zip";

export type RebaseOptions = { comed?: boolean };

export function rebaseToZipFunnel(
	redirectUrl: string,
	{ comed = false }: RebaseOptions = {},
): string {
	let url: URL;
	try {
		url = new URL(redirectUrl, window.location.origin);
	} catch {
		return redirectUrl;
	}

	// Pathname only, never origin: responses may be relative, and pinning an
	// origin would silently serve control on staging and apex hosts.
	if (comed && url.pathname === COMED_CANONICAL_PATH) {
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
