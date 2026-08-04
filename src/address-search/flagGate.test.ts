import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createFlagGate,
	FLAG_WAIT_TIMEOUT_MS,
} from "@/address-search/flagGate";

// onFeatureFlags is the whole variable: synchronous when flags are already
// loaded, async when they aren't, never when PostHog is absent.
type FlagState = "loaded" | "pending" | "absent";

/** Reusable harness — any future gated experiment can drive its arm through this. */
function harness({ flags, arm = "test" }: { flags: FlagState; arm?: string }) {
	const calls = { resolveArm: 0, onReady: 0, onTimeout: 0, subscribe: 0 };
	const timers: { callback: () => void; ms: number }[] = [];
	let loadFlags: (() => void) | undefined;

	const gate = createFlagGate<string>({
		onFeatureFlags: (callback) => {
			calls.subscribe += 1;
			if (flags === "absent") return false;
			if (flags === "loaded") callback();
			else loadFlags = callback;
			return true;
		},
		resolveArm: () => {
			calls.resolveArm += 1;
			return arm;
		},
		onTimeout: () => {
			calls.onTimeout += 1;
		},
		schedule: (callback, ms) => timers.push({ callback, ms }),
	});

	return {
		calls,
		timers,
		/** Ask for the arm, counting how often the gate had to notify us. */
		requestArm: () =>
			gate.arm(() => {
				calls.onReady += 1;
			}),
		/** PostHog resolves its flags (only meaningful for `pending`). */
		loadFlags: () => {
			assert.ok(loadFlags, "expected a flag subscription");
			loadFlags();
		},
		/** Fire the single pending timer. */
		runTimer: () => {
			assert.equal(timers.length, 1, "expected exactly one timer");
			timers[0].callback();
		},
	};
}

describe("createFlagGate", () => {
	// The reason the interface is one method: returning the arm instead of calling
	// back means the caller cannot be re-entered mid-render.
	test("already-loaded flags return the arm without ever notifying", () => {
		const h = harness({ flags: "loaded", arm: "control" });

		assert.equal(h.requestArm(), "control");
		assert.equal(h.calls.onReady, 0, "no callback — the return delivered it");
		assert.equal(h.timers.length, 0, "no timer armed once already resolved");
	});

	test("pending flags withhold the arm, then notify once loaded", () => {
		const h = harness({ flags: "pending" });

		assert.equal(h.requestArm(), undefined, "nothing to render yet");
		assert.equal(h.calls.onReady, 0);
		assert.equal(h.calls.resolveArm, 0, "no exposure while still waiting");

		h.loadFlags();
		assert.equal(h.calls.onReady, 1);
		assert.equal(h.requestArm(), "test");
	});

	test("a timeout reports itself and still yields an arm", () => {
		const h = harness({ flags: "pending" });
		h.requestArm();
		assert.equal(h.timers[0].ms, FLAG_WAIT_TIMEOUT_MS);

		h.runTimer();
		assert.equal(h.calls.onTimeout, 1, "timed out with PostHog present");
		assert.equal(h.calls.onReady, 1);
		assert.equal(h.requestArm(), "test");
	});

	test("flags that beat the timeout report no timeout", () => {
		const h = harness({ flags: "pending" });
		h.requestArm();

		h.loadFlags();
		h.runTimer();

		assert.equal(h.calls.onTimeout, 0);
		assert.equal(h.calls.onReady, 1, "notified once, not twice");
		assert.equal(h.calls.resolveArm, 1);
	});

	// Absent is not a timeout — there was never anything to wait for.
	test("absent PostHog settles on a zero delay with no timeout reported", () => {
		const h = harness({ flags: "absent", arm: "unassigned" });

		assert.equal(h.requestArm(), undefined, "deferred, not synchronous");
		assert.equal(h.timers[0].ms, 0);

		h.runTimer();
		assert.equal(h.calls.onTimeout, 0);
		assert.equal(h.requestArm(), "unassigned");
	});

	// renderApp runs on connect, on every attribute change, and on reconnect.
	test("repeat calls while waiting subscribe and arm a timer only once", () => {
		const h = harness({ flags: "pending" });

		assert.equal(h.requestArm(), undefined);
		assert.equal(h.requestArm(), undefined);
		assert.equal(h.requestArm(), undefined);

		assert.equal(h.calls.subscribe, 1);
		assert.equal(h.timers.length, 1);
	});

	// Hygiene rather than correctness: PostHog scores exposure per person, so
	// duplicates collapse — but each one is its own unbatched sendBeacon.
	test("the arm resolves once and is memoized across calls", () => {
		const h = harness({ flags: "loaded" });

		assert.equal(h.requestArm(), "test");
		assert.equal(h.requestArm(), "test");
		assert.equal(h.requestArm(), "test");
		assert.equal(h.calls.resolveArm, 1);
	});

	// Positive control: proves the counter can exceed one, so the assertion above
	// measures memoization rather than a resolver that never runs.
	test("separate gates resolve independently — the memo is per instance", () => {
		const first = harness({ flags: "loaded" });
		const second = harness({ flags: "loaded" });

		first.requestArm();
		second.requestArm();

		assert.equal(first.calls.resolveArm, 1);
		assert.equal(second.calls.resolveArm, 1);
	});

	// A falsy arm must not read as "unresolved" to the memo.
	test("an empty-string arm is still treated as resolved", () => {
		const h = harness({ flags: "loaded", arm: "" });

		assert.equal(h.requestArm(), "");
		assert.equal(h.requestArm(), "");
		assert.equal(
			h.calls.resolveArm,
			1,
			"the box, not the value, marks resolved",
		);
	});
});
