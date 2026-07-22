import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { bootstrap } from "@/utils/googleMaps";
import { AddressSearchApp } from "./AddressSearchApp";
import modalStyleSheet from "./modal/styles.module.css?inline";
import styleSheet from "./styles.module.css?inline";
import { ZipSearchApp } from "./ZipSearchApp";

function parseProps(el: HTMLElement) {
	const publicApiKey = el.getAttribute("public-key") || "";
	const placeholder = el.getAttribute("placeholder") || undefined;
	const cta = el.getAttribute("cta") || undefined;
	const isEnergyOnly = el.getAttribute("is-energy-only") === "true";
	const mode = el.getAttribute("mode") === "zip" ? "zip" : "address";
	return { publicApiKey, placeholder, cta, isEnergyOnly, mode };
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
	private shadowRootRef?: ShadowRoot;
	private container?: HTMLElement;
	private overlayRoot?: ShadowRoot;
	private overlayWrapper?: HTMLElement;
	private reactRoot?: Root;
	// `mode` is intentionally not observed: it is a static embed attribute, so
	// runtime flips are unsupported.
	static get observedAttributes() {
		return ["public-key", "placeholder", "cta", "is-energy-only"];
	}

	private emit(eventName: string) {
		return (detail: unknown) =>
			this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}

	connectedCallback() {
		if (!this.shadowRootRef) {
			this.shadowRootRef = this.attachShadow({ mode: "open" });
			const styles = document.createElement("style");
			styles.textContent = styleSheet;
			this.shadowRootRef.appendChild(styles);

			this.container = document.createElement("div");
			this.shadowRootRef.appendChild(this.container);
		}
		if (!this.overlayRoot) {
			this.overlayWrapper = document.createElement("div");
			this.overlayRoot = this.overlayWrapper.attachShadow({ mode: "open" });
			const styles = document.createElement("style");
			styles.textContent = styleSheet;
			this.overlayRoot.appendChild(styles);

			const modalStyles = document.createElement("style");
			modalStyles.textContent = modalStyleSheet;
			this.overlayRoot.appendChild(modalStyles);

			document.body.appendChild(this.overlayWrapper);
		}

		if (!this.reactRoot && this.container) {
			this.reactRoot = createRoot(this.container);
		}
		this.renderApp();
	}

	attributeChangedCallback() {
		this.renderApp();
	}

	disconnectedCallback() {
		this.reactRoot?.unmount();
		this.reactRoot = undefined;
		this.overlayWrapper?.remove();
		this.overlayRoot = undefined;
		this.overlayWrapper = undefined;
	}

	private renderApp() {
		if (!this.reactRoot || !this.overlayRoot) return;
		const props = parseProps(this);
		const zIndex = getZIndex(this.shadowRootRef?.host as HTMLElement);

		if (props.mode === "zip") {
			this.reactRoot.render(
				<StrictMode>
					<ZipSearchApp
						portalRoot={this.overlayRoot}
						cta={props.cta}
						onResultEvent={this.emit("result")}
						onErrorEvent={this.emit("error")}
					/>
				</StrictMode>,
			);
			return;
		}

		// Google Places is only needed by the address entry; zip-mode elements
		// return above. The key check and (idempotent) bootstrap live here, on the
		// address render path, rather than connectedCallback.
		if (!props.publicApiKey) {
			throw new Error("bpc-address-search: public-key is required");
		}
		bootstrap({ key: props.publicApiKey, v: "weekly", libraries: ["places"] });

		this.reactRoot.render(
			<StrictMode>
				<AddressSearchApp
					placeholder={props.placeholder}
					cta={props.cta}
					isEnergyOnly={props.isEnergyOnly}
					portalRoot={this.overlayRoot}
					zIndex={zIndex}
					onSelectEvent={this.emit("select")}
					onResultEvent={this.emit("result")}
					onErrorEvent={this.emit("error")}
				/>
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
