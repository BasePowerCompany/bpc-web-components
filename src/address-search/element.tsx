import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  fetchHydration,
  setUtilityUserConfirmed,
} from "@/address-search/fetch";
import type {
  AddressResult,
  RedirectStrategy,
  RedirectStrategyMultiple,
} from "@/address-search/types";
import { bootstrap } from "@/utils/googleMaps";
import type { AddressSearchProps } from "./AddressSearch";
import { AddressSearch } from "./AddressSearch";
import { ModalOverlay } from "./ModalOverlay";
import styleSheet from "./styles.module.css?inline";
import styles from "./styles.module.css";

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
      console.log(result);
      if (result.success && result.data.redirectStrategy.isMultiple) {
        this.multipleResult = {
          redirectUrl: result.data.redirectUrl,
          redirectStrategy: result.data.redirectStrategy,
          externalAddressId: result.data.externalAddressId,
        };
        this.render();
        return;
      }

      if (result.success) {
        // Fire the result event to the parent
        this.dispatchEvent(
          new CustomEvent("result", {
            detail: { result: result.data, selection: detail.selection },
          })
        );
      } else {
        // Fire the error event to the parent
        this.dispatchEvent(
          new CustomEvent("error", { detail: { error: result.error } })
        );
      }
    };

    const zIndex = getZIndex(this.root?.host as HTMLElement);

    const onSelectUtilityFromModal = async (utility: string) => {
      // Try to find the utility selection for the multiple result.
      const found = this.multipleResult?.redirectStrategy.multiple.options.find(
        (opt) => opt.value === utility
      );
      console.log("FOUND", found);
      if (!found) {
        return;
      }
      // If utility is "OTHER", Don't set utility user confirmed, just dispatch event.
      if (utility === "OTHER") {
        this.dispatchEvent(
          new CustomEvent("result", {
            detail: { result: this.multipleResult, selection: this.selection },
          })
        );
        this.multipleResult = undefined;
        this.selection = undefined;
        this.render();
        return;
      }
      // If we can't find an external address id, return (shouldn't ever get here).
      if (!this.multipleResult?.externalAddressId) return;
      // Set the user-confirmed utility.
      try {
        await setUtilityUserConfirmed(
          utility,
          this.multipleResult.externalAddressId
        );
      } catch (err) {
        console.error("Error setting utility user confirmed", err);
      }
      // Dispatch a the event to route the user based on their option.
      this.dispatchEvent(
        new CustomEvent("result", {
          detail: {
            result: { redirectUrl: found.redirectUrl },
            selection: this.selection,
          },
        })
      );
      // Reset state.
      this.multipleResult = undefined;
      this.selection = undefined;
      this.render();
    };

    createRoot(this.container).render(
      <StrictMode>
        <AddressSearch
          {...props}
          zIndex={zIndex}
          onSelect={onSelect}
          portalRoot={this.overlayRoot}
        />
        <ModalOverlay
          portalRoot={this.overlayRoot}
          isOpen={!!this.multipleResult}
          onClose={() => {
            this.multipleResult = undefined;
            this.render();
          }}
          zIndex={1000}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "start",
              height: "100%",
            }}
          >
            <h2>Who is your utility?</h2>
            <div>
              <p
                style={{
                  marginBottom: 30,
                  textAlign: "center",
                  fontStyle: "italic",
                  color: "#9e9e9e",
                }}
              >
                This helps us determine where to send you next.
              </p>
              <div className={styles.modalButtonGroup}>
                {this.multipleResult?.redirectStrategy.multiple.options.map(
                  (option) => (
                    <button
                      className={styles.modalButton}
                      key={option.value}
                      onClick={() => onSelectUtilityFromModal(option.value)}
                    >
                      {option.name}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </ModalOverlay>
      </StrictMode>
    );
  }
}

customElements.define("bpc-address-search", AddressSearchElement);
