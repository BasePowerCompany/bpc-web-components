# Address Validation Failure Samples (L7D, TX, non-homebuilder)

Source: `addresses` table, `address_confirmation = 'UNCONFIRMED'`, `created_at >= NOW() - INTERVAL '7 days'`. Queried 2026-04-17.

## Summary

Total addresses L7D: 10,692. GOOGLE_CONFIRMED: 9,932 (92.9%). UNCONFIRMED: 759 (7.1%). SLA target: ≥ 95%.

| Bucket | Count | % of failures |
|---|---|---|
| Unconfirmed street_number | 502 | 66% |
| Unconfirmed subpremise | 106 | 14% |
| Missing subpremise | 90 | 12% |
| Unconfirmed locality | 27 | 3.5% |
| Unconfirmed point_of_interest | 25 | 3.3% |
| Unconfirmed postal_code | 4 | — |
| Unconfirmed route | 3 | — |
| Unconfirmed country | 2 | — |

---

## 1. Unconfirmed street_number (502 cases, 66%)

**Nature:** Real Places-indexed addresses that USPS DPV cannot confirm. Verified by probing neighbors (±2 house numbers on same street) — all return the same unconfirmed result with footnote `AAM3` (ZIP+4 matched, primary not matched) or `A1` (not found). These are **rural routes, new-construction subdivisions, and USPS blind spots** — not typos. Places Autocomplete DOES suggest them, so users selected from the dropdown.

Example Google Validation API response for `13607 Champion Forest Dr, Houston, TX 77069`:
```json
{
  "verdict": { "possibleNextAction": "ACCEPT", "hasUnconfirmedComponents": true, "addressComplete": true },
  "unconfirmedComponentTypes": ["street_number"],
  "uspsData": { "dpvConfirmation": "N", "dpvFootnote": "AAM3" },
  "addressComponents": [
    { "type": "street_number", "name": "13607", "confirmationLevel": "UNCONFIRMED_BUT_PLAUSIBLE" },
    { "type": "route",         "name": "Champion Forest Drive", "confirmationLevel": "CONFIRMED" },
    ...
  ]
}
```

Note `possibleNextAction=ACCEPT` — the frontend accepts silently, but the server later flags it UNCONFIRMED because `hasUnconfirmedComponents=true`. **This is the frontend↔backend gap.**

Real samples:

| line_1 | city | postal | created |
|---|---|---|---|
| 6203 AVENUE P 1/2 REAR | GALVESTON | 77551 | 2026-04-17 |
| 1575 BRADFORD DR | ARLINGTON | 76010 | 2026-04-17 |
| 13607 CHAMPION FOREST DR | HOUSTON | 77069 | 2026-04-17 |
| 404 ROBERTSTOWN RD | COPPERAS COVE | 76522 | 2026-04-17 |
| 309 RED BUD LN | ROUND ROCK | 78665 | 2026-04-17 |
| 2290 COUNTY RD 313 LOOP | GLEN ROSE | 76043 | 2026-04-17 |
| 2821 S LAS VEGAS TRL | WHITE SETTLEMENT | 76108 | 2026-04-17 |
| 17123 BLACKHAWK BLVD | HOUSTON | 77089 | 2026-04-17 |
| 2003 FOREST VILLAGE DR | KINGWOOD | 77339 | 2026-04-17 |
| 7427 AURELIA MIST LN | HUMBLE | 77396 | 2026-04-17 |
| 1137 FM1406 | WINNIE | 77665 | 2026-04-17 |
| 5348 OLD BULLARD RD | TYLER | 75703 | 2026-04-17 |
| 1723 CHEROKEE ROSE TRL | AUBREY | 76227 | 2026-04-17 |
| 4802 MONTFORD DR | COLLEYVILLE | 76034 | 2026-04-17 |
| 4802 MONTCLAIR DR | COLLEYVILLE | 76034 | 2026-04-17 |
| 1696 US-290 | FREDERICKSBURG | 78624 | 2026-04-17 |
| 77302 CRIGHTON RD | CONROE | 77302 | 2026-04-17 |
| 7603 IRIDHAM DR | KILLEEN | 76542 | 2026-04-17 |
| 6180 AZLE HWY | AZLE | 76020 | 2026-04-17 |

**Neighbor-probe verification** (all ±2 on same street returned the same unconfirmed status):
- Champion Forest Dr, Houston: 13605 / 13607 / 13609 → all UNCONFIRMED (dpv=N, footnote=AAM3)
- Robertstown Rd, Copperas Cove: 402 / 404 / 406 → all UNCONFIRMED (dpv=None, footnote=A1)
- Red Bud Ln, Round Rock: 307 / 309 / 311 → all UNCONFIRMED (dpv=None, footnote=A1)
- Aurelia Mist Ln, Humble: 7425 / 7427 / 7429 → all UNCONFIRMED (dpv=None, footnote=A1)
- Forest Village Dr, Kingwood: 2001 / 2003 / 2005 → all UNCONFIRMED (dpv=None, footnote=A1)

---

## 2. Missing subpremise (90 cases, 12%)

**Nature:** Google Validation API returns `possibleNextAction=CONFIRM_ADD_SUBPREMISES` with `missingComponentTypes=[subpremise]` and often `addressRecordType=H` (high-rise). But in verification via Places Text Search, **7 of 8 sampled addresses are `primaryType=premise`** (single-family homes, not multi-unit). Current modal blocks submission until the user enters something in line_2 → users either bail or type garbage.

Example API response for `938 Ramblewood St, Harker Heights, TX 76548` (a house, per Places):
```json
{
  "verdict": { "possibleNextAction": "CONFIRM_ADD_SUBPREMISES", "hasInferredComponents": true },
  "missingComponentTypes": ["subpremise"],
  "uspsData": { "dpvConfirmation": "D", "dpvFootnote": "AAN1", "addressRecordType": "H" }
}
```

Places Text Search for the same address:
```json
{ "types": ["premise", "street_address"], "primaryType": "premise" }
```

Real samples:

| line_1 | city | postal | Places primaryType |
|---|---|---|---|
| 6314 TAGGART ST | HOUSTON | 77007 | premise |
| 940 W UNIVERSITY AVE | GEORGETOWN | 78626 | **subpremise** (legit multi-unit) |
| 938 RAMBLEWOOD ST | HARKER HEIGHTS | 76548 | premise |
| 810 S AMY LN | HARKER HEIGHTS | 76548 | premise |
| 808 WILSON RD | WACO | 76705 | premise |
| 802 N COLLEGE ST | KILLEEN | 76541 | premise |
| 7388 PARKRIDGE BLVD | IRVING | 75063 | premise |
| 1700 COUNTY ROAD 1106 | ATHENS | 75751 | premise |

**Implication:** The current "Missing subpremise" modal is **over-firing** on SFHs. Offering an escape hatch ("This is a single-family home") both improves SLA and stops forcing users into bad-data paths.

---

## 3. Unconfirmed subpremise (106 cases, 14%)

**Nature:** Mixed. Subset is users typing garbage into the unit field (which our current modal directly causes). Other subset is real multi-units with a mis-entered apt number. Google returns `possibleNextAction=ACCEPT` + `unconfirmedComponentTypes=[subpremise]`, so we currently submit silently.

Example for `17714 Red Oak Drive 134A, Houston`:
```json
{
  "verdict": { "possibleNextAction": "ACCEPT", "hasUnconfirmedComponents": true, "hasInferredComponents": true },
  "unconfirmedComponentTypes": ["subpremise"],
  "uspsData": { "dpvConfirmation": "S", "dpvFootnote": "AAC1", "addressRecordType": "H" }
}
```

Real samples (notice the garbage):

| line_1 | subpremise value |
|---|---|
| 6903 CO RD 166 #1218 | `1218` |
| 17714 RED OAK DRIVE 134A | `134A` (looks legit) |
| 12951 BRIAR FOREST DRIVE 409 | `409` (looks legit) |
| 8823 HAVERSTOCK DR D | `d` ← junk |
| 18806 BOX FORT LN L | `l` ← junk |
| 3969 ALTOONA DR APT 239 | `apt 239` ← prefix duplicated |
| 3251 BRADS WAY SHOP | `Shop` ← description, not a unit |
| 303 S COLLEGE ST B187 | `b187` |
| 1509 SOUTHWOOD HILLS DRIVE HOME | `HOME` ← description |
| 4511 BONNIE BRAE ST - WATER PUMP | `Water Pump` ← description |
| 3390 FM1377 HOUSE | `HOUSE` ← description |
| 4525 S BONNIE BRAE ST - GUEST HOUSE | `Guest House` ← description |
| 4525 BONNIE BRAE ST - POOL PUMP | `Pool Pump` ← description |
| 1005 EXCHANGE BLVD BASECAMP 1 | `Basecamp 1` |
| 6486 N LONG AVE # AVE # B | `B` |
| 200 S HUGHES ST UNIT A | `UNIT A RESI` ← garbage tail |
| 5556 NEW TERRITORY BOULEVARD 605 | `605` (looks legit) |
| 8300 BISSONNET STREET SUITE 219 | `Suite 219` ← prefix duplicated |
| 10777 RICHMOND AVENUE 10777 | `10777` ← house# duplicated into unit |
| 6301 OLD BROWNSVLE RD # 78417 | `78417` ← zip in unit field |
| 1799 FM 528 ROAD 14102 | `14102` |
| 2001 KATI JANE LN L | `l` ← junk |
| 929 CHASTIEN CT FRNT | `FRNT` ← description |
| 425 E LAMAR BLVD # BLVD # O | `O` |
| 3731 N O CONNOR RD # 3731 C | `3731 C` ← house# duplicated |

**Patterns identified:**
- Users type descriptions of what they want powered: `HOUSE`, `HOME`, `Shop`, `Water Pump`, `Pool Pump`, `Guest House`, `Basecamp 1`, `FRNT`
- Users type junk to bypass the forced-subpremise modal: single letters `l`, `d`, `B`, `O`, `c`, `f`
- Prefix duplication: users type `apt 239`, `Suite 219`, `UNIT A` when the form already has an "Apt/Suite" label
- Identifier leakage: house number or zip ending up in the unit field

---

## 4. Unconfirmed locality (27 cases, 3.5%)

**Nature:** Google disagrees with the city name but the rest of the address is fine. Usually the city exists but Google prefers a different standardized form (Census Designated Place vs incorporated city, etc.). Low-severity.

Real samples:

| line_1 | city | postal |
|---|---|---|
| 6558 TERAMO TER | HUTTO | 78634 |
| 27700 KATY FWY | BROOKSHIRE | 77423 |
| 4302 JUNIPER LN | LA PORTE | 77571 |
| 4020 SANDERS DR | PROSPER | 75078 |
| 31610 ZOE PT | CYPRESS | 77433 |
| 104 HIGHLAND PRAIRIE WY | PINE ISLAND | 77445 |
| 12917 WINTERY TIDE DR | SANTA FE | 77510 |
| 3703 TIMBER GRV CT | ROSHARON | 77583 |
| 4027 HEATHERTON DR | PROSPER | 75078 |
| 249 WOLFHUNTER LN | GAINESVILLE | 76240 |
| 2606 BAYROSE DR | SANTA FE | 77510 |
| 13514 RAIN LILY DR | SANTA FE | 77510 |
| 8563 BANDON DUNES DR | ALLEN | 75013 |
| 2609 FAIRHILL LN | GRAPEVINE | 76051 |
| 22211 MALTA BLF DR | TOMBALL | 77377 |

---

## 5. Unconfirmed point_of_interest (25 cases, 3.3%) — **LIKELY BUG**

**Nature:** Almost all cases (23/25) contain URL fragments inside the address string: `/selection?first_name=<name>`. This is not a user-input problem — this is an **integration bug** where something is concatenating a URL path/query onto the address before canonicalization.

Real samples:

| line_1 | address_errors (first line) |
|---|---|
| 2402 ANTON DR SELECTION?FIRST NAME=ANGELA | Unconfirmed point_of_interest: selection?first_name=Angela |
| 2447 CO RD 2710 | `.../Caddo Mills, TX 75135, USA/selection?first_name=Ann` |
| 1651 CASTLEFORD DR SELECTION?FIRST NAME=ANTHONY | ... |
| 505 VIRGINIA LN | `.../Wylie, TX 75098, USA/selection?first_name=Aubry Test` |
| 1195 FM 1564 | `.../Quinlan, TX 75474, USA/selection?first_name=Chad` |
| 612 RIDGE MEADOW DR | `.../New Braunfels, TX 78130, USA/selection?first_name=Derek` |
| 1334 BINFIELD DR SELECTION?FIRST NAME=ERICA | ... |
| 429 OLEANDER DR | `.../Royse City, TX 75189, USA/selection?first_name=Jake` |
| 200 GRAND VISTA | `.../Cibolo, TX 78108, USA/selection?first_name=jeffrey` |
| 2105 STILTON CV SELECTION?FIRST NAME=JENNIFER | ... |
| 4013 N STATE HWY 78 | `.../Wylie, TX 75098, USA/selection?first_name=Josh` |
| 342 SAGE MEADOW RD | `.../Wylie, TX 75098, USA/selection?first_name=Julian` |
| 4940 CO RD 2708 | `.../Caddo Mills, TX 75135, USA/selection?first_name=Kimberly` |
| 143 BROOK MEADOW | `.../Cibolo, TX 78108, USA/selection?first_name=Mary` |
| 503 SILVER BIRCH DR SELECTION?FIRST NAME=RAMIRO | ... |
| 303 SADDLE PK | `.../Cibolo, TX 78108, USA/selection?first_name=Robert` |
| 262 MAIDSTONE COVE | `.../Cibolo, TX 78108, USA/selection?first_name=Rudy` |
| 3433 WHISPER HAVEN | `.../Schertz, TX 78108, USA/selection?first_name=Sean` |
| 5140 COLUMBIA DR SELECTION?FIRST NAME=SUSAN | ... |
| 404 KINGS WY | `.../Cibolo, TX 78108, USA/selection?first_name=Teresa` |
| 321 MYSTIC WY | `.../Cibolo, TX 78108, USA/selection?first_name=Victor` |
| 117 SPRING BROOK | `.../Cibolo, TX 78108, USA/selection?first_name=William` |
| 315 DESERT WILLOW WAY SELECTION?FIRST NAME=WILLIAM | ... |

The remaining 2 in this bucket are user-input noise:
- `6500 S COCKRELL HILL RD INTERSTATE 20` (freeway reference concatenated)
- `1401 COUNTY ROAD 118 APT 2206 MI DIRECCIN CORRECTA ES:` (Spanish note: "my correct address is:" — user pasted a comment into the address field)

**Recommended action:** Separate bug to find the caller polluting the address string with URL/query data. Worth spawning as a follow-up task.

---

## 6. Unconfirmed postal_code / route / country (9 cases total)

**Nature:** Long tail, mostly low-volume and odd inputs.

| Category | line_1 | city | postal | error |
|---|---|---|---|---|
| country | 18723 MYSTIC MAPLE LN HARRIS | CYPRESS | 77433 | `country: HARRIS` (county name in wrong field) |
| country | 709 MISTY MORNING WAY HELLO | ROUND ROCK | 78664 | `country: Hello` (user typed placeholder) |
| postal_code | 610 AN COUNTY RD 346 | NECHES | 75779 | rare city/zip mismatch |
| postal_code | 2864 SUNCREEK LN | LEAGUE CITY | 77573 | `775730000` (zip+4 all zeros, likely system default) |
| postal_code | 304 GLADE BRIDGE LN | LEAGUE CITY | 77573 | `77573-0000` (same all-zeros pattern) |

---

## Methodology

Queries used (all on the `resources` Postgres DB):

```sql
-- Category counts
SELECT
  CASE
    WHEN split_part(address_errors, chr(10), 1) LIKE 'Missing %'     THEN split_part(split_part(address_errors, chr(10), 1), ':', 1)
    WHEN split_part(address_errors, chr(10), 1) LIKE 'Unconfirmed %' THEN 'Unconfirmed ' || split_part(split_part(split_part(address_errors, chr(10), 1), ' ', 2), ':', 1)
    ELSE split_part(split_part(address_errors, chr(10), 1), ':', 1)
  END AS error_type,
  COUNT(*)
FROM addresses
WHERE state = 'TX'
  AND address_confirmation = 'UNCONFIRMED'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 2 DESC;
```

Google API probes used:

```bash
# Address Validation API
curl "https://addressvalidation.googleapis.com/v1:validateAddress?key=..." \
  -d '{"address":{"regionCode":"US","addressLines":["..."]}}'

# Places Text Search (New API) — for primaryType verification
curl -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "X-Goog-FieldMask: places.types,places.primaryType,places.formattedAddress" \
  -d '{"textQuery":"..."}'

# Places Autocomplete — to confirm users could pick the address from the dropdown
curl -X POST "https://places.googleapis.com/v1/places:autocomplete" \
  -d '{"input":"...","includedRegionCodes":["us"]}'
```
