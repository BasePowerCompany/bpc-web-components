import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { resolveEnergyDestination } from "@/address-search/energyDestination";
import {
	ctaForComedArm,
	ctaForEnergyArm,
	resolveZipEntryComedArm,
	resolveZipEntryEnergyArm,
	ZIP_ENTRY_COMED_FLAG,
	ZIP_ENTRY_ENERGY_FLAG,
} from "@/address-search/experiments";
import { createFlagGate } from "@/address-search/flagGate";
import { resolveFocusTarget } from "@/address-search/focusTarget";
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
	const preferredUtility = el.getAttribute("preferred-utility") || undefined;
	const modeAttr = el.getAttribute("mode");
	const mode =
		modeAttr === "zip"
			? "zip"
			: modeAttr === "zip-comed"
				? "zip-comed"
				: modeAttr === "zip-energy"
					? "zip-energy"
					: "address";
	return {
		publicApiKey,
		placeholder,
		cta,
		isEnergyOnly,
		preferredUtility,
		mode,
	};
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
	// Its own gate, so an energy embed's wait never resolves the ComEd arm (or the
	// reverse) and each experiment memoizes one exposure independently.
	private readonly energyGate = createFlagGate({
		resolveArm: resolveZipEntryEnergyArm,
		onTimeout: () =>
			posthogCapture("zip_entry_flags_timeout", {
				flag: ZIP_ENTRY_ENERGY_FLAG,
			}),
	});
	// `mode` is intentionally not observed: it is a static embed attribute, so
	// runtime flips are unsupported.
	static get observedAttributes() {
		return [
			"public-key",
			"placeholder",
			"cta",
			"is-energy-only",
			"preferred-utility",
		];
	}

	private emit(eventName: string) {
		return (detail: unknown) =>
			this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}

	// Forward host focus() to the real text input, so a host page's
	// `getElementById(id).focus()` reaches the encapsulated input and triggers
	// its onFocus (open/activation). See ./focusTarget for why address entry
	// needs the overlay fallback.
	focus(options?: FocusOptions) {
		resolveFocusTarget(this.shadowRootRef, this.overlayRoot)?.focus(options);
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

		let energyArm: ReturnType<typeof resolveZipEntryEnergyArm> | undefined;
		if (props.mode === "zip-energy") {
			energyArm = this.energyGate.arm(() => this.renderApp());
			if (!energyArm) {
				this.reactRoot.render(null);
				return;
			}
		}

		// One call site for every zip arm; control/unassigned fall through to address.
		const isComedTestArm = comedArm === "test";
		const isEnergyTestArm = energyArm === "t1" || energyArm === "t2";
		const renderZipEntry =
			props.mode === "zip" || isComedTestArm || isEnergyTestArm;

		if (renderZipEntry) {
			// Energy arms resolve their own destination (utility lookup + funnel URL);
			// every other zip entry asks the zip router. See ./energyFunnel for why
			// they cannot share it.
			const energyDestination =
				energyArm === "t1" || energyArm === "t2"
					? (zip: string) => resolveEnergyDestination({ arm: energyArm, zip })
					: undefined;
			this.reactRoot.render(
				<StrictMode>
					<ZipSearchApp
						portalRoot={this.overlayRoot}
						cta={
							props.mode === "zip-energy"
								? ctaForEnergyArm(energyArm ?? "unassigned", props.cta)
								: ctaForComedArm("zip", props.mode === "zip-comed", props.cta)
						}
						preferredUtility={props.preferredUtility}
						resolveDestination={energyDestination}
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
					cta={
						props.mode === "zip-energy"
							? ctaForEnergyArm(energyArm ?? "unassigned", props.cta)
							: ctaForComedArm("address", props.mode === "zip-comed", props.cta)
					}
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
