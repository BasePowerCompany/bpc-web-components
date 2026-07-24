// The deregulated-market TDSP codes the backend returns for Oncor / CenterPoint
// service areas. These replaced the legacy "DEREG" placeholder value.
export const DEREGULATED_UTILITIES = new Set(["ONCOR", "CENTERPOINT"]);

/** Uppercased utility if it's a deregulated-market TDSP, else undefined. */
export function normalizeDeregulatedUtility(
	utility: string | undefined,
): string | undefined {
	const u = utility?.trim().toUpperCase();
	return u && DEREGULATED_UTILITIES.has(u) ? u : undefined;
}
