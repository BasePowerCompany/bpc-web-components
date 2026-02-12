import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { bootstrap } from "@/utils/googleMaps";
import { AddressSearchApp } from "./AddressSearchApp";
import modalStyleSheet from "./modal/styles.module.css?inline";
import styleSheet from "./styles.module.css?inline";

function parseProps(el: HTMLElement): Omit<
	AddressSearchProps,
	"zIndex" | "portalRoot"
> & {
	publicApiKey: string;
	isEnergyOnly: boolean;
} {
	const publicApiKey = el.getAttribute("public-key") || "";
	const placeholder = el.getAttribute("placeholder") || undefined;
	const cta = el.getAttribute("cta") || undefined;
	const isEnergyOnly = el.getAttribute("is-energy-only") === "true";
	return { publicApiKey, placeholder, cta, isEnergyOnly };
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
	private multipleUtilityResult?: {
		redirectUrl: string;
		redirectStrategy: RedirectStrategyMultipleUtility;
		externalAddressId: string;
	};
	private externalAddressId?: string;
	private multipleAddressResults?: RedirectMultipleAddress;
	private selection?: AddressResult;
	private energySplashRedirectUrl?: string;
	static get observedAttributes() {
		return ["public-key", "placeholder", "cta", "is-energy-only"];
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

		const props = parseProps(this);
		if (!props.publicApiKey) {
			throw new Error("bpc-address-search: public-key is required");
		}
		bootstrap({ key: props.publicApiKey, v: "weekly", libraries: ["places"] });

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

			// Fetch the hydration data
			const result = await fetchHydration(
				detail.selection,
				detail.confirmAddress,
				props.isEnergyOnly,
			);
			if (result.success) {
				this.externalAddressId = result.data.externalAddressId;
				if (result.data.redirectStrategy.isMultiple) {
					// multiple utility result
					this.multipleUtilityResult = {
						redirectUrl: result.data.redirectUrl,
						redirectStrategy: result.data.redirectStrategy,
						externalAddressId: result.data.externalAddressId,
					};
					// clear multiple address results
					this.multipleAddressResults = undefined;
					posthogCapture("address_search_multiple_utility_result", {
						selection: detail.selection,
						multipleResult: this.multipleUtilityResult,
					});
					this.render();
					return;
				} else if (result.data.redirectStrategy.isMultipleAddresses) {
					// multiple address result
					this.multipleAddressResults =
						result.data.redirectStrategy.multipleAddresses;
					// clear multiple utility results
					this.multipleUtilityResult = undefined;
					posthogCapture("address_search_multiple_address_result", {
						selection: detail.selection,
						multipleResult: this.multipleAddressResults,
					});
					this.render();
					return;
				} else {
					// fetchHydration returns single result success, dispatch to parent
					posthogCapture("address_search_single_result", {
						selection: detail.selection,
					});

					if (props.isEnergyOnly) {
						// Show splash screen before redirecting
						this.energySplashRedirectUrl = result.data.redirectUrl;
						this.render();
						return;
					}

					this.dispatchEvent(
						new CustomEvent("result", {
							detail: { result: result.data, selection: detail.selection },
						}),
					);
				}
			} else {
				// fetchHydration failed, dispatch error to parent
				posthogCapture("address_search_no_result", {
					selection: detail.selection,
				});
				this.dispatchEvent(
					new CustomEvent("error", { detail: { error: result.error } }),
				);
			}
		};

		const zIndex = getZIndex(this.root?.host as HTMLElement);

		const onRedirect = (redirectUrl: string) => {
			// Dispatch the result event to route the user to redirectUrl
			this.dispatchEvent(
				new CustomEvent("result", {
					detail: {
						result: { redirectUrl },
						selection: this.selection,
					},
				}),
			);
		};

		const onUserSelectAddress = (address: AddressResult) => {
			// when user selects an address from the AddressSelectionContent
			// we don't want to confirm the address, user will be redirected
			onSelect({ selection: address, confirmAddress: false });
		};

		const onBack = () => {
			this.multipleUtilityResult = undefined;
			this.multipleAddressResults = undefined;
			this.selection = undefined;
			this.externalAddressId = undefined;
			this.energySplashRedirectUrl = undefined;
			this.render();
		};

		const shouldShowModal =
			this.selection &&
			(this.multipleAddressResults != null ||
				this.multipleUtilityResult != null ||
				this.energySplashRedirectUrl != null);

		createRoot(this.container).render(
			<StrictMode>
				<AddressSearchApp
					placeholder={props.placeholder}
					cta={props.cta}
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
				{shouldShowModal &&
					createPortal(
						<SelectionModal
							address={this.selection?.formattedAddress ?? ""}
							externalAddressId={this.externalAddressId ?? ""}
							multipleAddressOptions={this.multipleAddressResults}
							multipleUtilityOptions={
								this.multipleUtilityResult?.redirectStrategy.multiple.options
							}
							energySplashRedirectUrl={this.energySplashRedirectUrl}
							onSelectAddress={onUserSelectAddress}
							onTriggerRedirect={onRedirect}
							onBack={onBack}
						/>,
						this.overlayRoot,
					)}
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
