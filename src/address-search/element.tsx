import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
	posthogOnFeatureFlags,
	resolveZipEntryArm,
} from "@/address-search/experiments";
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
	// "zip" marks the element as the zip-first experiment surface: the PostHog
	// flag (zip_entry_test_0701) decides whether the visitor sees the zip entry
	// (test) or the standard address search (control/unbucketed). Anything else
	// (default) always renders the address search.
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
	private flagsReady = false;
	private flagsRequested = false;
	static get observedAttributes() {
		return ["public-key", "placeholder", "cta", "is-energy-only", "mode"];
	}

	// Zip mode is experiment-gated (zip_entry_test_0701), and PostHog loads its
	// flags asynchronously — render nothing until they arrive so neither arm
	// sees the other's entry flash. The timeout covers PostHog being blocked or
	// absent: those visitors fall back to the address entry (unbucketed).
	private awaitFeatureFlags() {
		if (this.flagsRequested) return;
		this.flagsRequested = true;
		const resolve = () => {
			if (this.flagsReady) return;
			this.flagsReady = true;
			this.renderApp();
		};
		const subscribed = posthogOnFeatureFlags(resolve);
		window.setTimeout(resolve, subscribed ? 1500 : 0);
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
			if (!this.flagsReady) {
				this.awaitFeatureFlags();
				this.reactRoot.render(null);
				return;
			}
			// Control / unbucketed visitors fall through to the address entry.
			if (resolveZipEntryArm() === "zip") {
				this.reactRoot.render(
					<StrictMode>
						<ZipSearchApp
							placeholder={props.placeholder}
							cta={props.cta}
							portalRoot={this.overlayRoot}
							onResultEvent={(detail) =>
								this.dispatchEvent(new CustomEvent("result", { detail }))
							}
							onErrorEvent={(detail) =>
								this.dispatchEvent(new CustomEvent("error", { detail }))
							}
						/>
					</StrictMode>,
				);
				return;
			}
		}

		// The zip entry does not use Google Places, but zip mode still requires the
		// key: control-arm visitors get the address entry. Bootstrapping here
		// (idempotent) rather than in connectedCallback keeps address mode working
		// if `mode` is flipped at runtime.
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
					onSelectEvent={(detail) =>
						this.dispatchEvent(new CustomEvent("select", { detail }))
					}
					onResultEvent={(detail) =>
						this.dispatchEvent(new CustomEvent("result", { detail }))
					}
					onErrorEvent={(detail) =>
						this.dispatchEvent(new CustomEvent("error", { detail }))
					}
				/>
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
