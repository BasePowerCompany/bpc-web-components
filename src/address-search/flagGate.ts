// Holds a render-time experiment arm until PostHog's flags load, so neither arm
// flashes the other's entry. Deps injected to keep it testable without a DOM.

export const FLAG_WAIT_TIMEOUT_MS = 1500;

export type FlagGateDeps<TArm> = {
	/** False when PostHog isn't on the page — nothing to wait for. */
	onFeatureFlags: (callback: () => void) => boolean;
	/** Resolves the arm AND records its exposure, so call it once. */
	resolveArm: () => TArm;
	onTimeout: () => void;
	schedule?: (callback: () => void, ms: number) => void;
};

export type FlagGate<TArm> = {
	isReady: () => boolean;
	/** Idempotent, and may complete synchronously — render the placeholder first. */
	request: (onReady: () => void) => void;
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
					// Slow, not absent: posthog-js may still tag later events with the
					// test variant, so the mislabeling risk stays measurable.
					if (subscribed && !ready) deps.onTimeout();
					markReady();
				},
				// PostHog absent: nothing to wait for, defer only to stay async.
				subscribed ? FLAG_WAIT_TIMEOUT_MS : 0,
			);
		},

		arm() {
			resolved ??= { arm: deps.resolveArm() };
			return resolved.arm;
		},
	};
}
