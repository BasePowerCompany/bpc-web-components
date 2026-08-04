import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
	posthogOnFeatureFlags,
	resolveZipEntryComedArm,
	ZIP_ENTRY_COMED_FLAG,
} from "@/address-search/experiments";
import { createFlagGate } from "@/address-search/flagGate";
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
	const modeAttr = el.getAttribute("mode");
	const mode =
		modeAttr === "zip"
			? "zip"
			: modeAttr === "zip-comed"
				? "zip-comed"
				: "address";
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
	// mode="zip-comed" is experiment-gated (zip_entry_comed_0803): the arm can't
	// be known until PostHog's flags load, so the gate holds the render until
	// then and memoizes the arm (one exposure per element). Plain mode="zip" —
	// the concluded, fully-rolled-out dereg zip-first test — never touches it.
	private readonly comedGate = createFlagGate({
		onFeatureFlags: posthogOnFeatureFlags,
		resolveArm: resolveZipEntryComedArm,
		onTimeout: () =>
			posthogCapture("zip_entry_flags_timeout", {
				// Named so a ComEd timeout is separable from the historical TX ones
				// this event name already carries, and from any later experiment's.
				flag: ZIP_ENTRY_COMED_FLAG,
			}),
	});
	// `mode` is intentionally not observed: it is a static embed attribute, so
	// runtime flips are unsupported.
	static get observedAttributes() {
		return ["public-key", "placeholder", "cta", "is-energy-only"];
	}

	private emit(eventName: string) {
		return (detail: unknown) =>
			this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}

	// Forward host focus() to the real text input inside the shadow root, so a
	// host page's `getElementById(id).focus()` reaches the encapsulated input.
	// Focusing it triggers the input's onFocus (open/activation). No-op until
	// the app has mounted and the input exists.
	focus(options?: FocusOptions) {
		const input = this.shadowRootRef?.querySelector("input");
		input?.focus(options);
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

		// Render the placeholder BEFORE requesting flags: posthog-js calls back
		// synchronously when they have already loaded, which re-enters renderApp,
		// and a render(null) afterwards would overwrite the arm it just rendered.
		if (props.mode === "zip-comed" && !this.comedGate.isReady()) {
			this.reactRoot.render(null);
			this.comedGate.request(() => this.renderApp());
			return;
		}

		// One decision, one call site: the zip entry is either the unconditional
		// dereg mode or the ComEd test arm. Control and unassigned fall through to
		// the identical address entry below.
		const renderZipEntry =
			props.mode === "zip" ||
			(props.mode === "zip-comed" && this.comedGate.arm() === "test");

		if (renderZipEntry) {
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
