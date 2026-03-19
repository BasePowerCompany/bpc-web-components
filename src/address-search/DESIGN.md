# Address Search Architecture

## Purpose

The address-search package supports two UX flows that share Google Places
autocomplete but diverge after selection:

- `battery`
- `energy-only`

The architecture is designed so those flows can evolve independently without
re-entangling their UI logic, while still reusing the shared Google and routing
integration.

## Design Principles

1. Split by user flow, not by flags inside one large component.
2. Keep Google autocomplete mechanics separate from flow-specific form behavior.
3. Keep post-submit routing and modal behavior shared.
4. Prefer stable shared contracts over string parsing in UI components.

## Top-Level Structure

### `AddressSearchApp.tsx`

This is the composition root for address search.

Responsibilities:

- choose the active flow based on `isEnergyOnly`
- own the shared post-submit state machine
- render the shared selection modal / splash behavior

This file should stay focused on orchestration. It should not grow flow-specific
form logic.

### `BatteryAddressSearchFlow.tsx`

Battery owns the battery-specific pre-submit UX.

Responsibilities:

- render the shared autocomplete UI
- treat autocomplete selection as the final address choice
- submit immediately after selection

Battery should remain the simple path. If battery needs new UI fields in the
future, that should happen here, not in `AddressSearchApp.tsx`.

### `EnergyOnlyAddressEntryFlow.tsx`

Energy-only owns the energy-only pre-submit UX.

Responsibilities:

- render the shared autocomplete UI for `line_1`
- keep `line_2`, city, state, and ZIP behind a progressive disclosure toggle
- manage `line_2`, city, state, and ZIP form state when disclosed
- apply energy-only interaction rules before submission
- submit only when the user explicitly clicks `Continue`

This is the only place where the multi-field energy-only form behavior should
live.

## Shared UI Layer

### `Autocomplete.tsx`

This is a presentational combobox.

Responsibilities:

- render the input
- render the dropdown
- handle keyboard and focus interaction
- optionally render the CTA button

Non-responsibilities:

- fetching Google suggestions
- parsing Google place data
- deciding what the selected value means
- deciding when a selection should submit

This component should stay dumb. It is the reusable UI primitive for both
flows.

## Shared Data Layer

### `useAddressAutocomplete.ts`

This is the shared Google autocomplete controller.

Responsibilities:

- manage the Google Places session token lifecycle
- fetch autocomplete suggestions from the current input
- cache suggestions during a session
- resolve a selected suggestion into structured data

Outputs:

- `results`
  - UI-ready autocomplete suggestions for `Autocomplete.tsx`
- `resolveSelection`
  - turns a clicked suggestion into:
    - `selection`: backend-facing `AddressResult`
    - `googleAddressComponents`: parsed Google-derived components for UI use

Important boundary:

- this hook does not decide what `line_1` should display after selection

That decision belongs to the consuming flow:

- battery uses the full formatted address
- energy-only uses street-only `line_1` plus separate form fields

### `utils.ts`

This file contains shared parsing helpers.

Important helpers:

- `parseAddress`
  - existing shared parse path that produces `AddressResult`
- `parseGoogleAddressComponents`
  - Google-specific parsed shape for flow-level UI use

Guideline:

- shared helpers should focus on Google parsing and normalization
- each flow can shape its controlled form state into the final `AddressResult`

### `types.ts`

This file defines the stable shared contracts between:

- autocomplete resolution
- flow components
- submit/routing logic
- modal logic

In particular:

- `AddressResult` is the shared submit shape
- `ParsedGoogleAddressComponents` is the Google-derived parsed shape used for
  UI prefilling

## Submission and Modal Architecture

The post-submit behavior is shared even though the pre-submit UI differs.

That shared state machine lives in `AddressSearchApp.tsx` and handles:

- `fetchHydration`
- select/result/error event emission
- multiple utility results
- multiple address results
- energy-only splash redirect

This is intentionally centralized because both flows submit the same
`AddressResult` and then follow the same downstream routing behavior.

## Data Flow

### Battery

1. User types into `Autocomplete`
2. `useAddressAutocomplete` returns suggestions
3. User selects a suggestion
4. Battery resolves it into `AddressResult`
5. Battery submits immediately
6. `AddressSearchApp` handles shared post-submit behavior

### Energy-Only

1. User types into `Autocomplete`
2. `useAddressAutocomplete` returns suggestions
3. User selects a suggestion
4. Energy-only resolves it into:
   - `AddressResult`
   - `ParsedGoogleAddressComponents`
5. Collapsed mode keeps the selected autocomplete value in `line_1`
6. If the user expands apartment / unit entry, energy-only uses the parsed Google
   components to prefill `line_1`, `line_2`, city, state, and ZIP
7. User edits the disclosed fields as needed
8. Energy-only converts the active form state back into `AddressResult`
9. `AddressSearchApp` handles shared post-submit behavior

## Invariants

These boundaries should remain true:

- `Autocomplete.tsx` should remain UI-only
- `useAddressAutocomplete.ts` should remain Google/session-only
- flow components should own pre-submit UX behavior
- `AddressSearchApp.tsx` should own shared post-submit behavior
- `AddressResult` should remain the shared submit contract

If a future change breaks one of those boundaries, it should be treated as an
architecture decision, not a casual refactor.

## Extending the System

### If you need a new energy-only field

Add it in `EnergyOnlyAddressEntryFlow.tsx`, then update the transformation back
into `AddressResult` using shared helpers in `utils.ts`.

### If you need a new battery-specific behavior

Add it in `BatteryAddressSearchFlow.tsx` without changing energy-only UI code.

### If Google autocomplete behavior changes

Start in `useAddressAutocomplete.ts` and `utils.ts`.

### If routing or modal behavior changes

Start in `AddressSearchApp.tsx`.

## What Not To Do

- Do not reintroduce a single `AddressSearch` component with large
  `isEnergyOnly` branches.
- Do not move energy-only form state into `AddressSearchApp.tsx`.
- Do not make `Autocomplete.tsx` aware of battery vs energy-only semantics.
- Do not parse address strings in flow components when structured helpers exist.
