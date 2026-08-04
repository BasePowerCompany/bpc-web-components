/**
 * The render-time gate for an experiment-gated entry arm.
 *
 * PostHog loads flags asynchronously, so a render-time arm must show nothing
 * until they arrive or neither arm's entry can be trusted not to flash the
 * other's. This owns that wait plus the two things that are easy to get wrong
 * and impossible to see in a green build:
 *
 *  - `onFeatureFlags` fires its callback SYNCHRONOUSLY when flags have already
 *    loaded, so `request()` can complete before it returns. Callers must render
 *    their placeholder BEFORE calling it (`isReady()` is false either way), or a
 *    synchronous ready re-enters the render and is then overwritten by the
 *    placeholder — a permanently blank widget.
 *  - The arm is resolved ONCE and memoized. Resolving records the exposure, and
 *    since the flag is read with `send_event: false` posthog-js does not dedupe
 *    it, so resolving per render would multiply exposures on a second embed, an
 *    attribute change, or a DOM move.
 *
 * Deps are injected so all of this is testable without a DOM.
 */

/** Flags were slow, not absent — see `TIMEOUT_MS`. */
export const FLAG_WAIT_TIMEOUT_MS = 1500;

export type FlagGateDeps<TArm> = {
	/** Subscribe to flag load; false when PostHog isn't on the page. */
	onFeatureFlags: (callback: () => void) => boolean;
	/** Resolve (and record the exposure for) the visitor's arm. */
	resolveArm: () => TArm;
	/** Report that the wait timed out with PostHog present. */
	onTimeout: () => void;
	schedule?: (callback: () => void, ms: number) => void;
};

export type FlagGate<TArm> = {
	isReady: () => boolean;
	/** Idempotent. Call only after rendering the placeholder. */
	request: (onReady: () => void) => void;
	/** Memoized arm. Only meaningful once `isReady()`. */
	arm: () => TArm;
};

export function createFlagGate<TArm>(deps: FlagGateDeps<TArm>): FlagGate<TArm> {
	const schedule =
		deps.schedule ??
		((callback: () => void, ms: number) => {
			window.setTimeout(callback, ms);
		});
	let ready = false;
	let requested = false;
	let resolved: { arm: TArm } | undefined;

	return {
		isReady: () => ready,

		request(onReady) {
			if (requested) return;
			requested = true;
			const markReady = () => {
				if (ready) return;
				ready = true;
				onReady();
			};
			const subscribed = deps.onFeatureFlags(markReady);
			schedule(
				() => {
					// Timed out with PostHog present: this visitor gets the default arm,
					// but posthog-js may still tag their later events with the test
					// variant. Reported so that mislabeling risk stays measurable.
					if (subscribed && !ready) deps.onTimeout();
					markReady();
				},
				// Nothing to wait for when PostHog is absent — defer only to keep
				// `request()` from completing inside its own call.
				subscribed ? FLAG_WAIT_TIMEOUT_MS : 0,
			);
		},

		arm() {
			resolved ??= { arm: deps.resolveArm() };
			return resolved.arm;
		},
	};
}
