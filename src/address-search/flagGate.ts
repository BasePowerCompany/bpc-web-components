import { posthogOnFeatureFlags } from "@/address-search/experiments";

// Holds a render-time experiment arm until PostHog's flags load, so neither arm
// flashes the other's entry. Deps injected to keep it testable without a DOM.

export const FLAG_WAIT_TIMEOUT_MS = 1500;

// Required deps are per-experiment; the optional ones are ambient capabilities
// that default to the real thing and exist so tests can drive them.
export type FlagGateDeps<TArm> = {
	/** Also records the exposure, so the gate calls it at most once. */
	resolveArm: () => TArm;
	/** Waited and gave up, with PostHog present. */
	onTimeout: () => void;
	/** Must report false when PostHog is absent — that drives the timeout length. */
	onFeatureFlags?: (callback: () => void) => boolean;
	schedule?: (callback: () => void, ms: number) => void;
};

export type FlagGate<TArm> = {
	/**
	 * The arm, or undefined while flags are still loading — render a placeholder.
	 * `onReady` fires only when a wait was needed, never before this returns.
	 */
	arm: (onReady: () => void) => TArm | undefined;
};

export function createFlagGate<TArm>(deps: FlagGateDeps<TArm>): FlagGate<TArm> {
	const onFeatureFlags = deps.onFeatureFlags ?? posthogOnFeatureFlags;
	const schedule =
		deps.schedule ?? ((callback, ms) => window.setTimeout(callback, ms));
	// A box, not a bare arm: keeps "resolved?" true even for a falsy TArm.
	let resolved: { arm: TArm } | undefined;
	let waiting = false;

	return {
		arm(onReady) {
			// Already resolved, or a wait is already in flight: fall through to the
			// single return, which is the arm once known and undefined until then.
			if (!resolved && !waiting) {
				waiting = true;

				let handedBack = false;
				const settle = () => {
					if (resolved) return;
					resolved = { arm: deps.resolveArm() };
					// Until we hand back, the return below delivers the arm; notifying
					// now would re-enter and erase what the caller just rendered.
					if (handedBack) onReady();
				};

				const subscribed = onFeatureFlags(settle);
				// Flags already loaded — settle() ran synchronously, so no timer.
				if (!resolved) {
					schedule(
						() => {
							if (subscribed && !resolved) deps.onTimeout();
							settle();
						},
						// Nothing to wait for without PostHog; defer only to stay async.
						subscribed ? FLAG_WAIT_TIMEOUT_MS : 0,
					);
				}

				handedBack = true;
			}

			return resolved?.arm;
		},
	};
}
