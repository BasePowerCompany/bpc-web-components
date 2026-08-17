import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveFocusTarget } from "@/address-search/focusTarget";

// Minimal stand-ins for the two shadow roots: only querySelector is consulted,
// so this stays a DOM-free test of the selector precedence.
function root(match: (selector: string) => unknown): {
	querySelector: (selector: string) => unknown;
} {
	return { querySelector: (selector: string) => match(selector) ?? null };
}

/** Address entry: real input portalled out, only a hidden <button> proxy left. */
const addressShadowRoot = root((selector) =>
	selector === "input" ? null : null,
);

describe("resolveFocusTarget", () => {
	// The regression. Autocomplete leaves a visibility:hidden <button> in the
	// shadow root and portals the real input into the overlay root, so without the
	// fallback host focus() silently did nothing on /energy.
	test("address entry falls back to the portalled overlay input", () => {
		const overlayInput = { name: "address-search" };
		const overlayRoot = root((selector) =>
			selector === 'input[name="address-search"]' ? overlayInput : null,
		);

		assert.equal(
			resolveFocusTarget(addressShadowRoot as never, overlayRoot as never),
			overlayInput,
		);
	});

	// Positive control for the test above: with no overlay root there is nothing to
	// fall back to, proving the assertion measures the fallback rather than a stub
	// that returns something no matter what.
	test("address entry with no overlay root resolves to nothing", () => {
		assert.equal(
			resolveFocusTarget(addressShadowRoot as never, undefined),
			null,
		);
	});

	// Zip entry keeps its real input in the shadow root and must not be redirected.
	test("zip entry uses its own shadow-root input", () => {
		const zipInput = { name: "zip-search" };
		const shadowRoot = root((selector) =>
			selector === "input" ? zipInput : null,
		);
		const overlayInput = { name: "address-search" };
		const overlayRoot = root(() => overlayInput);

		assert.equal(
			resolveFocusTarget(shadowRoot as never, overlayRoot as never),
			zipInput,
			"the shadow root wins when it has an input of its own",
		);
	});

	// The overlay root also hosts the confirm and unit-number modals, so a bare
	// `input` fallback would steal focus into whichever modal rendered last.
	test("the fallback is scoped to the address-search input by name", () => {
		const modalInput = { name: "unit-number" };
		const overlayRoot = root((selector) =>
			selector === "input" ? modalInput : null,
		);

		assert.equal(
			resolveFocusTarget(addressShadowRoot as never, overlayRoot as never),
			null,
			"a modal input must not be treated as the address input",
		);
	});

	test("no roots at all is inert rather than a throw", () => {
		assert.equal(resolveFocusTarget(undefined, undefined), null);
	});
});
