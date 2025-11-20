import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { fetchHydration } from "@/address-search/fetch";
import type { AddressResult } from "@/address-search/types";
import { bootstrap } from "@/utils/googleMaps";
import type { AddressSearchProps } from "./AddressSearch";
import { AddressSearch } from "./AddressSearch";
import styleSheet from "./styles.module.css?inline";

function parseProps(el: HTMLElement): Omit<
	AddressSearchProps,
	"zIndex" | "portalRoot"
> & {
	publicApiKey: string;
} {
	const publicApiKey = el.getAttribute("public-key") || "";
	const placeholder = el.getAttribute("placeholder") || undefined;
	const cta = el.getAttribute("cta") || undefined;
	return { publicApiKey, placeholder, cta };
}

function getZIndex(el: HTMLElement) {
	const style = window.getComputedStyle(el);

	if (style.getPropertyValue("z-index") === "auto" && el.parentElement) {
		return getZIndex(el.parentElement);
	}

	const zIndex = Number(style.getPropertyValue("z-index"));
	if (!Number.isNaN(zIndex)) {
		return zIndex;
	}

	return 0;
}

class AddressSearchElement extends HTMLElement {
	private root?: ShadowRoot;
	private container?: HTMLElement;
	private overlayRoot?: ShadowRoot;
	private overlayWrapper?: HTMLElement;

	static get observedAttributes() {
		return ["public-key", "placeholder", "cta"];
	}

	connectedCallback() {
		if (!this.root) {
			this.root = this.attachShadow({ mode: "open" });
			const styles = document.createElement("style");
			styles.textContent = styleSheet;
			this.root.appendChild(styles);

			this.container = document.createElement("div");
			this.root.appendChild(this.container);
		}
		if (!this.overlayRoot) {
			this.overlayWrapper = document.createElement("div");
			this.overlayRoot = this.overlayWrapper.attachShadow({ mode: "open" });
			const styles = document.createElement("style");
			styles.textContent = styleSheet;
			this.overlayRoot.appendChild(styles);

			document.body.appendChild(this.overlayWrapper);
		}
		this.render();
	}

	attributeChangedCallback() {
		this.render();
	}

	disconnectedCallback() {
		if (this.container) createRoot(this.container).unmount();
	}

	private render() {
		if (!this.container || !this.overlayRoot) return;
		const props = parseProps(this);

		if (!props.publicApiKey) {
			throw new Error("bpc-address-search: public-key is required");
		}

		bootstrap({ key: props.publicApiKey, v: "weekly", libraries: ["places"] });

		const onSelect = async (detail: {
			selection: AddressResult | undefined;
		}) => {
			// Fire the select event to the parent
			this.dispatchEvent(new CustomEvent("select", { detail }));

			// If no selection, return
			if (!detail.selection) return;

			// Fetch the hydration data
			const result = await fetchHydration(detail.selection);
			if (result.success) {
				// Fire the result event to the parent
				this.dispatchEvent(
					new CustomEvent("result", {
						detail: { result: result.data, selection: detail.selection },
					}),
				);
			} else {
				// Fire the error event to the parent
				this.dispatchEvent(
					new CustomEvent("error", { detail: { error: result.error } }),
				);
			}
		};

		const zIndex = getZIndex(this.root?.host as HTMLElement);

		createRoot(this.container).render(
			<StrictMode>
				<AddressSearch
					{...props}
					zIndex={zIndex}
					onSelect={onSelect}
					portalRoot={this.overlayRoot}
				/>
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
