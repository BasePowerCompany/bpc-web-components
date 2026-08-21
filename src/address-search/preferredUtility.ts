import type { ZipRedirectStrategy } from "@/address-search/types";
import { posthogCapture } from "@/address-search/utils";

// Opt-in per embed, with no heuristic here on purpose: only the caller knows
// whether the other options on a zip are markets that can be rescued downstream.
export function autoSelectPreferredUtility({
	strategy,
	preferred,
	zip,
	emitRedirect,
}: {
	strategy: ZipRedirectStrategy;
	preferred: string | undefined;
	zip: string;
	// The caller's redirect path, so the option's URL still gets the attribution
	// decoration.
	emitRedirect: (redirectUrl: string, utility?: string) => void;
}): boolean {
	if (!preferred || !strategy.isMultiple) return false;

	const options = strategy.multiple.options;
	const match = options.find((option) => option.value === preferred);
	if (!match) return false;

	// Its own event, not an inference from a missing modal event: an auto-select
	// rate measured as an absence is unmeasurable.
	posthogCapture("zip_search_preferred_utility_auto_selected", {
		zip,
		utility: match.value,
		utilityOptions: options,
	});
	emitRedirect(match.redirectUrl, match.value);
	return true;
}
