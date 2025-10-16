import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { AddressResult } from "@/address-search/types";
import { bootstrap } from "@/utils/googleMaps";
import type { AddressSearchProps } from "./AddressSearch";
import { AddressSearch } from "./AddressSearch";
import styleSheet from "./styles.module.css?inline";

function parseProps(
	el: HTMLElement,
): AddressSearchProps & { publicApiKey: string } {
	const publicApiKey = el.getAttribute("public-key") || "";
	const placeholder = el.getAttribute("placeholder") || undefined;
	const cta = el.getAttribute("cta") || undefined;
	return { publicApiKey, placeholder, cta };
}

class AddressSearchElement extends HTMLElement {
	private root?: ShadowRoot;
	private container?: HTMLElement;

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
		this.render();
	}

	attributeChangedCallback() {
		this.render();
	}

	disconnectedCallback() {
		if (this.container) createRoot(this.container).unmount();
	}

	private render() {
		if (!this.container) return;
		const props = parseProps(this);

		if (!props.publicApiKey) {
			throw new Error("bpc-address-search: public-key is required");
		}

		bootstrap({ key: props.publicApiKey, v: "weekly", libraries: ["places"] });

		const onSelect = (detail: { result: AddressResult | undefined }) =>
			this.dispatchEvent(new CustomEvent("select", { detail }));

		createRoot(this.container).render(
			<StrictMode>
				<AddressSearch {...props} onSelect={onSelect} />
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
