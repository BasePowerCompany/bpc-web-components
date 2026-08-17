import {
	energyFunnelUrl,
	energyWaitlistUrl,
} from "@/address-search/energyFunnel";
import { fetchEnergyOnlyUtilities } from "@/address-search/fetch";
import { posthogCapture } from "@/address-search/utils";

/**
 * Destination for an energy zip arm: resolve the serving utility from the zip,
 * then build the URL it implies.
 *
 * Three outcomes. One utility sends that code to the funnel. No utilities means
 * the zip is outside the energy-only footprint, so the visitor goes to the
 * waitlist. Anything else — a failed lookup, or a zip straddling a TDSP boundary
 * — continues into the arm without a utility, and the reveal screen renders a
 * utility-agnostic rate recording `reason: "unknown_utility"`.
 *
 * The split between "no utilities" and "the lookup failed" is the load-bearing
 * one: both return no usable utility, but only the first is a statement about
 * the market. A failure means unknown, and must not tell a serviceable visitor
 * we do not serve them.
 */
export async function resolveEnergyDestination(params: {
	arm: "t1" | "t2";
	zip: string;
}): Promise<string> {
	const result = await fetchEnergyOnlyUtilities(params.zip);

	if (result.success && result.utilities.length === 0) {
		// The waitlist page carries no analytics of its own, so this is the only
		// record that the zip was entered and found unserved.
		posthogCapture("zip_search_energy_waitlist", {
			zip: params.zip,
			arm: params.arm,
		});
		return energyWaitlistUrl({ arm: params.arm, zip: params.zip });
	}

	const utility =
		result.success && result.utilities.length === 1
			? result.utilities[0]
			: undefined;
	return energyFunnelUrl({ arm: params.arm, zip: params.zip, utility });
}
