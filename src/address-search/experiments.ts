// PostHog experiment resolvers for the bpc-address-search element.

import { posthogCapture, posthogGetFeatureFlag } from "@/address-search/utils";

// Runs `callback` once PostHog's flags have loaded; returns false when PostHog
// is absent so the caller can fall back without waiting.
export const posthogOnFeatureFlags = (callback: () => void): boolean => {
	if (!window.posthog?.onFeatureFlags) return false;
	window.posthog.onFeatureFlags(callback);
	return true;
};

const PLAN_REVEAL_TEST_FLAG = "dereg_plan_reveal_0724";

// Logs exposure only for an assigned variant; unassigned users (outside the
// rollout) log nothing. Call only at divert time for an eligible user.
export function resolvePlanRevealArm(): "test" | "control" | "unassigned" {
	const variant = posthogGetFeatureFlag(PLAN_REVEAL_TEST_FLAG, {
		send_event: false,
	});
	if (variant !== "test" && variant !== "control") return "unassigned";
	posthogCapture("$feature_flag_called", {
		$feature_flag: PLAN_REVEAL_TEST_FLAG,
		$feature_flag_response: variant,
	});
	return variant;
}
