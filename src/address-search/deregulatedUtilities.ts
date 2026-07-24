// The deregulated-market TDSP codes the backend returns for Oncor / CenterPoint
// service areas. "DEREG" is a TEMPORARY backward-compat shim — the router still
// returns the legacy value until base-monorepo #31109 (TDSP swap) deploys;
// remove it once the server deploy finishes.
export const DEREGULATED_UTILITIES = new Set(["ONCOR", "CENTERPOINT", "DEREG"]);

/** Uppercased utility if it's a deregulated-market TDSP, else undefined. */
export function normalizeDeregulatedUtility(
	utility: string | undefined,
): string | undefined {
	const u = utility?.trim().toUpperCase();
	return u && DEREGULATED_UTILITIES.has(u) ? u : undefined;
}
