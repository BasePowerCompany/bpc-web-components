import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createFlagGate,
	FLAG_WAIT_TIMEOUT_MS,
} from "@/address-search/flagGate";

type Harness = {
	gate: ReturnType<typeof createFlagGate<string>>;
	readyCalls: number;
	resolveCalls: number;
	timeouts: number;
	/** Run the pending scheduled callback, asserting one was scheduled. */
	runScheduled: () => void;
	scheduledMs: number | undefined;
};

// PostHog's `onFeatureFlags` behavior is the whole variable: it fires
// synchronously when flags are already loaded, asynchronously when they aren't,
// and never (returning false) when PostHog is absent.
function harness(options: {
	flags: "loaded" | "pending" | "absent";
	arm?: string;
}): Harness {
	let scheduled: (() => void) | undefined;
	const state = { readyCalls: 0, resolveCalls: 0, timeouts: 0 };
	let fireFlags: (() => void) | undefined;

	const gate = createFlagGate<string>({
		onFeatureFlags: (callback) => {
			if (options.flags === "absent") return false;
			if (options.flags === "loaded") callback();
			else fireFlags = callback;
			return true;
		},
		resolveArm: () => {
			state.resolveCalls += 1;
			return options.arm ?? "test";
		},
		onTimeout: () => {
			state.timeouts += 1;
		},
		schedule: (callback, ms) => {
			scheduled = callback;
			harnessObject.scheduledMs = ms;
		},
	});

	const harnessObject: Harness = {
		gate,
		get readyCalls() {
			return state.readyCalls;
		},
		get resolveCalls() {
			return state.resolveCalls;
		},
		get timeouts() {
			return state.timeouts;
		},
		scheduledMs: undefined,
		runScheduled: () => {
			assert.ok(scheduled, "expected a scheduled timeout");
			scheduled();
		},
	};

	// `request` is always driven through this so the ready count is observable.
	const request = gate.request;
	gate.request = (onReady) =>
		request(() => {
			state.readyCalls += 1;
			onReady();
		});

	// Expose the async trigger by name for the pending case.
	(harnessObject as Harness & { fireFlags: () => void }).fireFlags = () => {
		assert.ok(fireFlags, "expected a flag subscription");
		fireFlags();
	};

	return harnessObject;
}

describe("createFlagGate", () => {
	// The defect this guards: `onFeatureFlags` calling back synchronously means
	// `request()` finishes ready. A caller that renders its placeholder AFTER
	// requesting would overwrite the real arm and leave the widget blank forever.
	test("already-loaded flags become ready during request(), not after", () => {
		const h = harness({ flags: "loaded" });
		assert.equal(h.gate.isReady(), false, "not ready before requesting");
		h.gate.request(() => {});
		assert.equal(h.gate.isReady(), true);
		assert.equal(h.readyCalls, 1);
	});

	test("pending flags stay un-ready until they load", () => {
		const h = harness({ flags: "pending" }) as ReturnType<typeof harness> & {
			fireFlags: () => void;
		};
		h.gate.request(() => {});
		assert.equal(h.gate.isReady(), false);
		assert.equal(h.readyCalls, 0);

		h.fireFlags();
		assert.equal(h.gate.isReady(), true);
		assert.equal(h.readyCalls, 1);
	});

	test("waits 1500ms when subscribed, and reports a timeout that fires first", () => {
		const h = harness({ flags: "pending" });
		h.gate.request(() => {});
		assert.equal(h.scheduledMs, FLAG_WAIT_TIMEOUT_MS);
		assert.equal(h.timeouts, 0);

		h.runScheduled();
		assert.equal(h.timeouts, 1, "timed out with PostHog present");
		assert.equal(h.gate.isReady(), true, "falls through to the default arm");
		assert.equal(h.readyCalls, 1);
	});

	test("flags that load before the timeout do not report one", () => {
		const h = harness({ flags: "pending" }) as ReturnType<typeof harness> & {
			fireFlags: () => void;
		};
		h.gate.request(() => {});
		h.fireFlags();
		h.runScheduled();

		assert.equal(h.timeouts, 0);
		assert.equal(h.readyCalls, 1, "ready is reported once, not twice");
	});

	// PostHog absent is not a timeout — there was never anything to wait for.
	test("absent PostHog resolves on a zero delay and reports no timeout", () => {
		const h = harness({ flags: "absent" });
		h.gate.request(() => {});
		assert.equal(h.scheduledMs, 0);
		assert.equal(h.gate.isReady(), false, "deferred, not synchronous");

		h.runScheduled();
		assert.equal(h.gate.isReady(), true);
		assert.equal(h.timeouts, 0, "nothing to time out on");
	});

	test("request is idempotent across repeated renders", () => {
		const h = harness({ flags: "pending" });
		h.gate.request(() => {});
		h.gate.request(() => {});
		h.gate.request(() => {});
		h.runScheduled();
		assert.equal(h.readyCalls, 1);
	});

	// The defect this guards: resolving records the exposure, and the flag is read
	// with send_event:false so posthog-js does not dedupe it. renderApp runs on
	// connect, on every attribute change and on reconnect — resolving per render
	// would multiply exposures and show up as inflated per-arm event volume.
	test("the arm is resolved once and memoized across calls", () => {
		const h = harness({ flags: "loaded", arm: "control" });
		h.gate.request(() => {});

		assert.equal(h.gate.arm(), "control");
		assert.equal(h.gate.arm(), "control");
		assert.equal(h.gate.arm(), "control");
		assert.equal(h.resolveCalls, 1, "exactly one exposure per element");
	});

	// Positive control: the counter can report more than one, so the assertion
	// above is measuring memoization rather than a resolver that never runs.
	test("two gates resolve independently (the memo is per element)", () => {
		const first = harness({ flags: "loaded" });
		const second = harness({ flags: "loaded" });
		first.gate.request(() => {});
		second.gate.request(() => {});
		first.gate.arm();
		second.gate.arm();

		assert.equal(first.resolveCalls, 1);
		assert.equal(second.resolveCalls, 1);
	});
});
