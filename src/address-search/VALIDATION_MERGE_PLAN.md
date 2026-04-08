# Address Validation Merge Plan

## Context

The address search widget calls two Google APIs in parallel when a user
selects an autocomplete suggestion:

1. **Places fetchFields** (`resolveSelection`) — resolves the clicked
   suggestion's `placeId` into structured address data. This is also what
   closes the autocomplete **session token**, so that typed keystrokes are
   billed as a single session rather than per-keystroke.
2. **Address Validation API** (`validateAddress`) — canonicalizes the
   address against Google's validation corpus, which is USPS-backed for
   US addresses.

Prior to this change, the final submitted selection always came from
Places, and the validation response was consulted only to decide whether
to open the subpremise confirmation modal.

## The bug

For `11712 Bull Creek Dr, Northlake`:

| Source                   | Postal code       | Formatted                                                       |
| ------------------------ | ----------------- | --------------------------------------------------------------- |
| Places Details API       | `76262` (wrong)   | `11712 Bull Creek Dr, Northlake, TX 76262, USA`                 |
| Address Validation API   | `76226-2564`      | `11712 Bull Creek Drive, Northlake, TX 76226-2564, USA`         |
| USPS (authoritative)     | `76226`           | `NORTHLAKE TX 76226-2564`                                       |

The Places Details endpoint returned a stale/incorrect ZIP (`76262`) for
this premise. Validation correctly inferred `76226` with
`inferred: true` and `confirmationLevel: CONFIRMED` and
`possibleNextAction: "ACCEPT"`.

Because the widget only looked at `requiresSubpremise`, the inferred ZIP
signal was discarded and `76262` was submitted. This also made the
frontend inconsistent with the backend, which runs its own validation
pass against USPS data and would see `76226`.

## Decision

**Treat the Address Validation API response as canonical whenever it
returns a `postalAddress`.** When validation is available, the widget
uses its data for every user-facing display and every submission path so
that:

- What the user sees in the input field
- What the subpremise confirmation modal prefills
- What is passed to `fetchHydration` / backend
- What is emitted through `onSelectEvent` / `onResultEvent`
- What is sent to PostHog analytics

...are all the same canonicalized address, consistent with the backend.

### Why keep `resolveSelection`?

Two reasons:

1. **Session-token billing.** Google Places Autocomplete (New) bundles
   autocomplete requests into the terminating Place Details call when a
   session token is used. Dropping `fetchFields` would promote every
   keystroke to per-request billing.
2. **Graceful fallback.** If the validation API is unreachable or
   returns an error, we still have the Places data to fall back on so
   the widget can continue to function.

### Rule

```
if validationResult.validatedAddress is present:
    use validated data
else:
    use Places data (current behavior)
```

No verdict gating. `ACCEPT`, `CONFIRM`, `CONFIRM_ADD_SUBPREMISES`, and
`FIX` all use validated data when a `postalAddress` is present. The
rationale: validation is the source of truth for the backend; if the
backend would have used it, so should the frontend.

The `requiresSubpremise` check (`possibleNextAction ===
"CONFIRM_ADD_SUBPREMISES"`) still controls whether the subpremise
confirmation modal opens, but the data shown inside the modal is the
merged validated data either way.

### ZIP format

Validation returns `"76226-2564"` (ZIP+4); Places returns `"76262"`
(5-digit). To stay consistent with existing backend expectations, the
merge strips to 5 digits (`postalCode.split("-")[0]`). Revisit if the
backend would benefit from ZIP+4.

### Coordinates

Validation returns its own `geocode.location`, but it's derived by
re-geocoding from text and can drift from the place the user actually
selected. Places lat/lng is preserved through the merge. (For Bull
Creek, both sources agreed within ~5 meters.)

## Implementation

### 1. `src/address-search/addressValidation.ts`

Add a `ValidatedAddress` shape and expose it on `AddressValidationResult`:

```ts
export type ValidatedAddress = {
  formattedAddress: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type AddressValidationResult = {
  // ...existing fields...
  validatedAddress?: ValidatedAddress;
};
```

Populate from `data.result.address.postalAddress` +
`data.result.address.formattedAddress`. Only set when both are present.

### 2. `src/address-search/utils.ts`

Add two pure merge helpers:

```ts
export function mergeValidatedSelection(
  selection: AddressResult,
  validated: ValidatedAddress,
): AddressResult;

export function mergeValidatedGoogleComponents(
  components: ParsedGoogleAddressComponents,
  validated: ValidatedAddress,
): ParsedGoogleAddressComponents;
```

Both preserve Places lat/lng. `mergeValidatedGoogleComponents` leaves
`line2` (subpremise) untouched — that field is user-driven via the
modal.

### 3. `src/address-search/BatteryAddressSearchFlow.tsx`

After awaiting both promises, compute `finalSelection` +
`finalGoogleComponents` by merging when `validatedAddress` is present.
Update:

- `setInputValue(finalSelection.formattedAddress)` — visible input text
- `onRequiresAddressConfirm({ selection: finalSelection, googleAddressComponents: finalGoogleComponents, validationResult })`
- `onSubmitSelection({ selection: finalSelection, confirmAddress: true })`

### 4. `src/address-search/EnergyOnlyAddressEntryFlow.tsx`

Same merge logic. Update:

- `setLine1(finalSelection.formattedAddress)` — visible input text
- `setSelectedSelection(finalSelection)` — so the later `handleContinue`
  submits the merged selection
- `onRequiresAddressConfirm({ selection: finalSelection, ... })`

### 5. `src/address-search/AddressSearchApp.tsx`

No changes. All downstream consumers
(`fetchHydration`, `onSelectEvent`, `onResultEvent`, `posthogCapture`,
`SelectionModal`) read from `detail.selection` / state `selection` that
originates in the flows, so they automatically receive the merged data.

### 6. `src/address-search/modal/AddressConfirmModal.tsx`

No changes. Its prefill reads
`googleAddressComponents.X || selection.address.X`. Since both are
merged before the modal is opened, the inputs start with the
canonicalized values.

## Affected user-facing surfaces after this change

| Surface                           | Source                                         |
| --------------------------------- | ---------------------------------------------- |
| Text input under the dropdown     | `finalSelection.formattedAddress`              |
| Subpremise confirmation modal     | Merged `googleAddressComponents` + selection   |
| `SelectionModal` (multi-result)   | `selection.formattedAddress` from parent state |
| Backend hydration request         | `finalSelection`                               |
| `onSelectEvent` / `onResultEvent` | `finalSelection`                               |
| PostHog analytics                 | `finalSelection`                               |

All driven by the same merged object.

## Trace: Bull Creek after the fix

1. User types `11712 Bull Creek Dr, Northlake`, picks the one suggestion.
2. Session token closes via `fetchFields` → Places returns ZIP `76262`.
3. `validateAddress` returns `postalAddress.postalCode = "76226-2564"`,
   `formattedAddress = "11712 Bull Creek Drive, Northlake, TX 76226-2564, USA"`.
4. Merge triggers: `finalSelection.address.postalCode = "76226"`,
   `finalSelection.formattedAddress = "11712 Bull Creek Drive, Northlake, TX 76226-2564, USA"`.
5. Input text updates to the validated formatted address — user sees
   the correction immediately.
6. `requiresSubpremise === false` → `onSubmitSelection(finalSelection)`.
7. Parent hydrates with `76226`, backend's own validation agrees,
   analytics records `76226`, subsequent modals (if any) show `76226`.

## Fallback behavior

- `validateAddress` throws / returns `SAFE_DEFAULT` →
  `validatedAddress` is `undefined` → merge is skipped → Places data
  flows through unchanged. No regression versus today.
- Places `resolveSelection` returns `undefined` (suggestion cache was
  cleared by a re-select) → existing `lastConfirmDataRef` fallback path
  still applies.

## Out of scope / follow-ups

- Broaden the confirmation modal trigger to include `CONFIRM` or
  `hasInferredComponents` when we want explicit user acknowledgement of
  a correction (today only `CONFIRM_ADD_SUBPREMISES` opens it).
- Preserve ZIP+4 end-to-end if the backend grows support for it.
- Persist the Google `placeId` on the submitted selection for analytics
  deduplication.
