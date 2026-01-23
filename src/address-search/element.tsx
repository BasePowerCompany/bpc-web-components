import { StrictMode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { fetchHydration } from "@/address-search/fetch";
import type {
	AddressResult,
	RedirectMultipleAddress,
	RedirectStrategyMultipleUtility,
} from "@/address-search/types";
import { UtilityModal } from "@/address-search/UtilityModal";
import { posthogCapture } from "@/address-search/utils";
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
	private multipleUtilityResult?: {
		redirectUrl: string;
		redirectStrategy: RedirectStrategyMultipleUtility;
		externalAddressId: string;
	};
	private externalAddressId?: string;
	private multipleAddressResults?: RedirectMultipleAddress;
	private selection?: AddressResult;
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
			confirmAddress: boolean;
		}) => {
			// Fire the select event to the parent

			this.selection = detail.selection;

			this.dispatchEvent(new CustomEvent("select", { detail }));

			// If no selection, return
			if (!detail.selection) return;

			// Fetch the hydration data
			const result = await fetchHydration(
				detail.selection,
				detail.confirmAddress,
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

		const shouldShowUtilityModal =
			this.selection &&
			(this.multipleAddressResults != null ||
				this.multipleUtilityResult != null);

		createRoot(this.container).render(
			<StrictMode>
				<AddressSearch
					{...props}
					zIndex={zIndex}
					onSelect={(detail) => {
						// the first time user selects address from AddresSearch
						// we always want to confirm the address
						onSelect({ ...detail, confirmAddress: true });
					}}
					portalRoot={this.overlayRoot}
				/>
				{shouldShowUtilityModal &&
					createPortal(
						<UtilityModal
							address={this.selection?.formattedAddress ?? ""}
							externalAddressId={this.externalAddressId ?? ""}
							utilityOptions={
								this.multipleUtilityResult?.redirectStrategy.multiple.options ??
								null
							}
							addressOptions={this.multipleAddressResults ?? null}
							onTriggerRedirect={onRedirect}
							onSelectAddress={onUserSelectAddress}
							onBack={() => {
								this.multipleUtilityResult = undefined;
								this.multipleAddressResults = undefined;
								this.selection = undefined;
								this.externalAddressId = undefined;
								this.render();
							}}
						/>,
						this.overlayRoot,
					)}
			</StrictMode>,
		);
	}
}

customElements.define("bpc-address-search", AddressSearchElement);
