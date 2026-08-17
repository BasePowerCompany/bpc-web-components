import { energyFunnelUrl } from "@/address-search/energyFunnel";
import { fetchEnergyOnlyUtilities } from "@/address-search/fetch";

/**
 * Destination for an energy zip arm: resolve the serving utility from the zip,
 * then build the funnel URL.
 *
 * Only an unambiguous single utility rides along. A failed lookup, a zip outside
 * the energy-only footprint (zero utilities), and a zip straddling a TDSP
 * boundary (several) all drop the utility and continue, so the visitor is never
 * blocked on a lookup — see ./energyFunnel for what the funnel does without one.
 *
 * Whether zero and multi-utility zips should instead waitlist or open the
 * utility picker is an open product question, not a settled default.
 */
export async function resolveEnergyDestination(params: {
	arm: "t1" | "t2";
	zip: string;
}): Promise<string> {
	const result = await fetchEnergyOnlyUtilities(params.zip);
	const utility =
		result.success && result.utilities.length === 1
			? result.utilities[0]
			: undefined;
	return energyFunnelUrl({ arm: params.arm, zip: params.zip, utility });
}
