# Address validation — manual test list

Real L7D failing addresses (TX, non-homebuilder) grouped by the `kind` our classifier should return. Use these to verify the modal UX for each branch. Copy-paste into the address search input and pick the matching autocomplete suggestion.

`ESID` column: from `address_metadata.esid_status`. `HAS_ESID` means a real ERCOT meter exists — legit occupied address. `NO_ESID` usually means new/unoccupied.

---

## `accept` — silent submit, no modal (DPV=Y or clean)

These should go through without a modal. Should see a brief spinner → redirect.

| Address | DPV | Why clean |
|---|---|---|
| `308 S Broadway Ave Unit 5, Tyler, TX 75702` | Y | confirmed unit |
| `3928 Tierra Marfil Rd, El Paso, TX 79938` | Y | confirmed SFH |
| `612 Poppy Mallow Ln, Dallas, TX 75211` | Y | confirmed SFH |
| `905 Beaumont Dr, Crystal Beach, TX 77650` | null | rural, no DPV data but verdict clean |
| `1125 Gardenwood Dr, Tyler, TX 75703` | Y | confirmed SFH |

---

## `missing_subpremise` — modal with SFH escape (90 L7D failures)

Expected UX: title *"Confirm your unit number"*, banner about multi-unit, SFH button visible.

| Address | ESID | Note |
|---|---|---|
| `938 Ramblewood St, Harker Heights, TX 76548` | — | Google says multi-unit; actually SFH per Places |
| `810 S Amy Ln, Harker Heights, TX 76548` | — | same pattern |
| `6314 Taggart St, Houston, TX 77007` | — | premise per Places |
| `802 N College St, Killeen, TX 76541` | — | premise per Places |
| `7388 Parkridge Blvd, Irving, TX 75063` | — | premise per Places |
| `940 W University Ave, Georgetown, TX 78626` | — | actually subpremise per Places — legit multi-unit |
| `1700 County Road 1106, Athens, TX 75751` | — | rural, SFH |
| `808 Wilson Rd, Waco, TX 76705` | — | SFH |

---

## `confirm_subpremise` — unit field prefilled with amber warning (108 L7D failures)

Expected UX: title *"Confirm your unit or meter detail"*, meter-aware banner, line_2 has the value and amber border.

### With HAS_ESID (real occupied unit, likely right but USPS doesn't confirm)

| Address | Subpremise value | ESID |
|---|---|---|
| `4408 Deere St Apt B1, Dallas, TX 75204` | B1 | 10443720008703291 |
| `5200 White Settlement Rd Apt 2323, Fort Worth, TX 76114` | 2323 | 10443720000681336 |
| `3309 Harrison St Apt 12, Bellmead, TX 76705` | 12 | 10443720003360467 |
| `836 Boca Ln Apt 259, Fort Worth, TX 76112` | 259 | 10443720001551812 |
| `10594 County Road 127 Trlr 1, Flint, TX 75762` | Trlr 1 | 10443720009069943 (trailer) |
| `52-7410 Hwy 6 Apt 302, Hitchcock, TX 77563` | 302 | 1008901023808934390100 |
| `10112 Cordoba Ct # B, Waco, TX 76708` | B | 10443720007968431 |

### Meter-level values (barn, pool pump, guest house, etc.)

| Address | Subpremise value | Note |
|---|---|---|
| `4525 S Bonnie Brae St, Argyle, TX 76226, Guest House` | Guest House | separate ADU meter |
| `4525 Bonnie Brae St, Argyle, TX 76226, Pool Pump` | Pool Pump | dedicated pump meter |
| `4511 Bonnie Brae St, Argyle, TX 76226, Water Pump` | Water Pump | dedicated pump meter |
| `3251 Brads Way Shop, Midlothian, TX 76065` | Shop | detached structure |
| `3390 FM 1377 House, Princeton, TX 75407` | House | main house on multi-meter property |
| `1005 Exchange Blvd Basecamp 1, Hutto, TX 78634` | Basecamp 1 | named unit |

### Typed apartment-number variants

| Address | Subpremise value |
|---|---|
| `17714 Red Oak Drive 134A, Houston, TX 77090` | 134A |
| `12951 Briar Forest Drive 409, Houston, TX 77077` | 409 |
| `5556 New Territory Boulevard 605, Sugar Land, TX 77479` | 605 |
| `6903 Co Rd 166 #1218, McKinney, TX 75071` | 1218 |
| `8300 Bissonnet Street Suite 219, Houston, TX 77074` | Suite 219 |

---

## `confirm_street_number` — line_1 amber warning (500 L7D failures, biggest bucket)

Expected UX: title *"Confirm your address"*, banner about new builds/rural, line_1 has amber border.

### Rural / county road

| Address | ESID | Type |
|---|---|---|
| `2290 County Rd 313 Loop, Glen Rose, TX 76043` | — | county road |
| `404 Robertstown Rd, Copperas Cove, TX 76522` | — | rural |
| `443 County Rd 4020 B, Dayton, TX 77535` | — | county road |
| `11115 N Farm To Market 1660, Hutto, TX 78634` | — | FM road |
| `6915 County Rd 683, Sweeny, TX 77480` | — | county road |
| `2832 County Road 443, Thorndale, TX 76577` | — | county road |
| `1137 FM 1406, Winnie, TX 77665` | — | FM road |
| `1696 US-290, Fredericksburg, TX 78624` | — | highway |

### New construction / subdivisions

| Address | ESID | Type |
|---|---|---|
| `13607 Champion Forest Dr, Houston, TX 77069` | — | new subdivision |
| `309 Red Bud Ln, Round Rock, TX 78665` | — | new build |
| `7427 Aurelia Mist Ln, Humble, TX 77396` | — | new build |
| `13108 Soap Winecup Mallow Tr, Elgin, TX 78621` | — | new subdivision |
| `1975 Island Falls Ct, League City, TX 77573` | — | new build |
| `1723 Cherokee Rose Trl, Aubrey, TX 76227` | — | new build |

### HAS_ESID (real occupied, flagged anyway)

| Address | ESID | Notable |
|---|---|---|
| `6620 S Gessner Rd # 1108, Houston, TX 77036` | 1008901023814461490103 | only one with actual enrollment |
| `505 E Front St, Arlington, TX 76011` | — | downtown |
| `300 West St, Hutto, TX 78634` | — | — |
| `2689 FM 2657, Copperas Cove, TX 76522` | — | — |
| `218 Live Oak Ln, Friendswood, TX 77546` | — | — |
| `4912 Evergreen Dr, Alvin, TX 77511` | — | — |
| `6446 Anita St, Houston, TX 77004` | — | — |

### Urban addresses Google geocodes fine but USPS doesn't confirm

| Address | Note |
|---|---|
| `1425 Bell St, Houston, TX 77002` | downtown |
| `230 W 34th St, Houston, TX 77018` | |
| `623 W 11th St, Houston, TX 77008` | |
| `6035 Windcrest Dr, Dallas, TX 75243` | |

---

## `confirm_components` — specific field(s) named in banner (36 L7D failures)

Expected UX: title *"Confirm your address"*, banner names the specific field (*"We couldn't verify the city"*, *"We couldn't verify the street name and ZIP code"*). Matching field has amber border.

### Locality (city) unconfirmed

| Address | Note |
|---|---|
| `31610 Zoe Pt, Cypress, TX 77433` | Cypress is a CDP, not incorporated |
| `3703 Timber Grv Ct, Rosharon, TX 77583` | |
| `12917 Wintery Tide Dr, Santa Fe, TX 77510` | |
| `104 Highland Prairie Wy, Pine Island, TX 77445` | |
| `249 Wolfhunter Ln, Gainesville, TX 76240` | |
| `4020 Sanders Dr, Prosper, TX 75078` | |
| `8563 Bandon Dunes Dr, Allen, TX 75013` | |

### Route (street name) unconfirmed

| Address |
|---|
| `3850 FM 518, League City, TX 77573` |
| `195 Co Rd 3115, Jacksonville, TX 75766` |
| `204 US-79 BUS, Taylor, TX 76574` |

### Postal code unconfirmed

| Address |
|---|
| `610 An County Rd 346, Neches, TX 75779` |
| `2864 Suncreek Ln, League City, TX 77573` |
| `304 Glade Bridge Ln, League City, TX 77573` |

---

## `block` — red banner, still allows override (rare)

Expected UX: title *"We couldn't find this address"*, red banner, Continue button still works.

| Address | Why |
|---|---|
| `6558 Teramo Ter, Hutto, TX 78634` | FIX verdict, locality + postal unconfirmed |

---

## Edge cases worth stress-testing

These aren't proper `kind` examples but exercise the UI in interesting ways.

| Scenario | Example | What to watch |
|---|---|---|
| Single-family home with barn meter | (type the SFH address, modal fires `missing_subpremise`, click SFH button, re-enter with `Barn`) | SFH button clears line_2 correctly; re-entering doesn't re-prompt if DPV matches |
| Very long route name | `13108 Soap Winecup Mallow Tr, Elgin, TX 78621` | Line_1 input handles long text without wrap issue |
| Spanish input contamination (from prior bug data) | (don't type the `/selection?first_name=...` cases manually — those were from a URL bug, not user input) | — |
| Dismissing modal | Click backdrop or Esc on any modal | `address_validation_dismiss` event fires; autocomplete input retains value |
| Re-selecting same suggestion | Pick the same result twice | `lastConfirmDataRef` fallback should re-show modal, not break |

---

## How to watch the events

Open devtools Network tab, filter by `posthog`. For each interaction you should see:

**Silent submit (accept):**
```
address_validation_result  { kind: "accept", confirmation_path: "silent", ... }
```

**Modal shown:**
```
address_validation_result  { kind: "<kind>", possibleNextAction, dpvConfirmation, dpvFootnote, ... }
```

**Override (Confirm / SFH / edited submit):**
```
address_validation_override  { kind, user_action: "confirmed_as_is" | "confirmed_sfh" | "edited", editedLine1, editedLine2, ... }
```

**Dismiss (close button / Esc / backdrop):**
```
address_validation_dismiss  { kind }
```

PostHog stamps every event with a server-side timestamp, so latency between `address_validation_result` and `address_validation_override` can be derived there — no need for client-side timing fields.
