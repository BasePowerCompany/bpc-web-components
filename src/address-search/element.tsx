import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
	posthogOnFeatureFlags,
	resolveZipEntryArm,
} from "@/address-search/experiments";
import { posthogCapture } from "@/address-search/utils";
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
	private flagsReady = false;
	private flagsRequested = false;
	// `mode` is intentionally not observed: it is a static embed attribute, so
	// runtime flips are unsupported.
	static get observedAttributes() {
		return ["public-key", "placeholder", "cta", "is-energy-only"];
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
		window.setTimeout(
			() => {
				if (subscribed && !this.flagsReady) {
					// Flags were slow, not absent: the visitor gets the address entry
					// but posthog-js may later tag their events with the test variant.
					// Captured (queued until PostHog loads) so this mislabeling risk is
					// measurable during the experiment.
					posthogCapture("zip_entry_flags_timeout", {});
				}
				resolve();
			},
			subscribed ? 1500 : 0,
		);
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
							cta={props.cta}
							portalRoot={this.overlayRoot}
							onResultEvent={this.emit("result")}
							onErrorEvent={this.emit("error")}
						/>
					</StrictMode>,
				);
				return;
			}
		}

		// Google Places is only needed by the address entry, and a zip-mode element
		// doesn't know it will render one until the flag resolves — so the key check
		// and (idempotent) bootstrap live here, on the address render path, instead
		// of connectedCallback. Test-arm visitors never load Places.
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
