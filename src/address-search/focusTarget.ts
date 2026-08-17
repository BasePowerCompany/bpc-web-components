// Which input a host page's `element.focus()` should land on.
//
// Zip entry keeps its real input in the host shadow root. Address entry does
// not: Autocomplete portals the real input into the overlay root and leaves a
// visibility:hidden <button> behind as a measuring proxy — so the shadow root
// holds no <input> at all and a bare querySelector("input") finds nothing,
// making host focus() a no-op on /energy while it worked on the homepage.
//
// The overlay fallback is name-scoped: the same overlay root also hosts the
// confirm and unit-number modals, and a bare `input` would grab one of those.

type QueryRoot = Pick<ParentNode, "querySelector">;

export function resolveFocusTarget(
	shadowRoot: QueryRoot | undefined,
	overlayRoot: QueryRoot | undefined,
): HTMLInputElement | null {
	return (
		shadowRoot?.querySelector<HTMLInputElement>("input") ??
		overlayRoot?.querySelector<HTMLInputElement>(
			'input[name="address-search"]',
		) ??
		null
	);
}
