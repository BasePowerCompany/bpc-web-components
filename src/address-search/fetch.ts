import type { AddressResult, HydrationResult } from "@/address-search/types";

export function fetchHydration(
  selection: AddressResult
): Promise<HydrationResult> {
  return fetch(import.meta.env.VITE_BPC_ADDRESS_REDIRECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ selection }),
  })
    .then((res) => res.json() as Promise<HydrationResult>)
    .catch((error) => {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    });
}
