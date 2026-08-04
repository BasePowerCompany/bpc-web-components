import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
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
	// Only mode="zip-comed" is gated; plain mode="zip" is fully rolled out and
	// never touches this. Memoized, so one exposure per element.
	private readonly comedGate = createFlagGate({
		resolveArm: resolveZipEntryComedArm,
		// Tagged: this event name also carries the concluded TX experiment's timeouts.
		onTimeout: () =>
			posthogCapture("zip_entry_flags_timeout", { flag: ZIP_ENTRY_COMED_FLAG }),
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

		let comedArm: ReturnType<typeof resolveZipEntryComedArm> | undefined;
		if (props.mode === "zip-comed") {
			comedArm = this.comedGate.arm(() => this.renderApp());
			// Arm unknown until flags load: render nothing rather than the wrong entry.
			if (!comedArm) {
				this.reactRoot.render(null);
				return;
			}
		}

		// One call site for both zip arms; control/unassigned fall through to address.
		const isComedTestArm = comedArm === "test";
		const renderZipEntry = props.mode === "zip" || isComedTestArm;

		if (renderZipEntry) {
			this.reactRoot.render(
				<StrictMode>
					<ZipSearchApp
						portalRoot={this.overlayRoot}
						cta={props.cta}
						// Only this arm rewrites the Illinois destination; a rolled-out
						// zip embed must leave an Illinois zip on its canonical page.
						comedArm={isComedTestArm}
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
