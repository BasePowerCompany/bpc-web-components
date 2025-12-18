import { StrictMode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import {
	fetchHydration,
	setUtilityUserConfirmed,
} from "@/address-search/fetch";
import type {
	AddressResult,
	RedirectMultipleOption,
	RedirectStrategyMultiple,
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
	private multipleResult?: {
		redirectUrl: string;
		redirectStrategy: RedirectStrategyMultiple;
		externalAddressId: string;
	};
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
		}) => {
			// Fire the select event to the parent

			this.selection = detail.selection;

			this.dispatchEvent(new CustomEvent("select", { detail }));

			// If no selection, return
			if (!detail.selection) return;

			// Fetch the hydration data
			const result = await fetchHydration(detail.selection);
			if (result.success && result.data.redirectStrategy.isMultiple) {
				this.multipleResult = {
					redirectUrl: result.data.redirectUrl,
					redirectStrategy: result.data.redirectStrategy,
					externalAddressId: result.data.externalAddressId,
				};
				posthogCapture("address_search_multiple_result", {
					selection: detail.selection,
					multipleResult: this.multipleResult,
				});
				this.render();
				return;
			}

			if (result.success) {
				posthogCapture("address_search_single_result", {
					selection: detail.selection,
				});
				// Fire the result event to the parent
				this.dispatchEvent(
					new CustomEvent("result", {
						detail: { result: result.data, selection: detail.selection },
					}),
				);
			} else {
				posthogCapture("address_search_no_result", {
					selection: detail.selection,
				});
				// Fire the error event to the parent
				this.dispatchEvent(
					new CustomEvent("error", { detail: { error: result.error } }),
				);
			}
		};

		const zIndex = getZIndex(this.root?.host as HTMLElement);

		const onSelectUtilityFromModal = async (option: RedirectMultipleOption) => {
			const utility = option.value;
			// Try to find the utility selection for the multiple result.
			const found = this.multipleResult?.redirectStrategy.multiple.options.find(
				(opt) => opt.value === utility,
			);
			if (!found) {
				posthogCapture("address_search_modal_selection_not_found", {
					selection: this.selection,
					utility: utility,
					multipleResult: this.multipleResult,
				});
				return;
			}
			// If utility is "OTHER", Don't set utility user confirmed, just dispatch event.
			if (utility === "OTHER") {
				posthogCapture("address_search_modal_selection_utility_other", {
					selection: this.selection,
					utility: utility,
					multipleResult: found,
				});

				this.dispatchEvent(
					new CustomEvent("result", {
						detail: { result: found, selection: this.selection },
					}),
				);
				return;
			}
			// If we can't find an external address id, return (shouldn't ever get here).
			if (!this.multipleResult?.externalAddressId) {
				posthogCapture(
					"address_search_multiple_result_unreachable_external_address_id_not_found",
					{
						selection: this.selection,
						utility: utility,
						multipleResult: this.multipleResult,
					},
				);
				return;
			}
			// Set the user-confirmed utility.
			try {
				await setUtilityUserConfirmed(
					utility,
					this.multipleResult.externalAddressId,
				);
				posthogCapture("address_search_set_utility_confirmed_success", {
					selection: this.selection,
					utility: utility,
					multipleResult: this.multipleResult,
				});
			} catch (err) {
				posthogCapture("address_search_set_utility_confirmed_error", {
					selection: this.selection,
					utility: utility,
					multipleResult: this.multipleResult,
				});
				console.error("Error setting utility user confirmed", err);
			}
			// Dispatch a the event to route the user based on their option.
			this.dispatchEvent(
				new CustomEvent("result", {
					detail: {
						result: { redirectUrl: found.redirectUrl },
						selection: this.selection,
					},
				}),
			);
		};

		createRoot(this.container).render(
			<StrictMode>
				<AddressSearch
					{...props}
					zIndex={zIndex}
					onSelect={onSelect}
					portalRoot={this.overlayRoot}
				/>
				{this.multipleResult &&
					this.selection &&
					createPortal(
						<UtilityModal
							{...props}
							onSelect={onSelectUtilityFromModal}
							address={this.selection?.formattedAddress ?? ""}
							options={
								this.multipleResult?.redirectStrategy.multiple.options ?? []
							}
							onBack={() => {
								this.multipleResult = undefined;
								this.selection = undefined;
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
