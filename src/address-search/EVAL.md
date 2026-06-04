# Address Autocomplete Eval

Regression set for the Places API (New) call in
[`useAddressAutocomplete.ts`](./useAddressAutocomplete.ts). Each row documents
an input that the autocomplete must handle and the address(es) that must appear
in the suggestion list. Re-run via the curl snippet at the bottom whenever
`includedPrimaryTypes` or the autocomplete request shape changes.

## Configuration under test

```jsonc
{
  "includedPrimaryTypes": [
    "street_address",
    "premise",
    "subpremise",
    "point_of_interest",
    "establishment"
  ],
  "languageCode": "en"
}
```

Rationale for this set: Google's published "Search Destinations" filter
(https://developers.google.com/maps/documentation/geocoding/search-for-destinations).
The previous `["street_address"]` filter dropped any address Google classified
as `premise` / `subpremise` / POI — which is most multifamily and many Texas
suburban / new-construction addresses.

## Required suggestions

The expected address must appear in the response for the given input. Every row
below was an empirical miss under the prior `["street_address"]`-only filter.

| Input | Must include | Google's primary type | Reported by / context |
|---|---|---|---|
| `2740 castlebridge` | `2740 Castlebridge, The Colony, TX` | `premise` | User report, 2026-06-04 |
| `11103 alpenhorn` | `11103 Alpenhorn Place, Tomball, TX` | `premise` | ljosephy, PR #53 (closed, 2026-05-26) |
| `1200 Barton` | `1200 Barton Hills Drive, Austin, TX` | `premise` | Sampled Austin residential |
| `1200 Barton` | `1200 Barton Springs Road, Austin, TX` | `subpremise` | Apartment-bearing road |
| `1200 Barton` | `1200 Barton Creek Boulevard, Austin, TX` | `premise` | Sampled Austin residential |
| `4801 W Park` | `4801 West Park Boulevard, Plano, TX` | `premise` | Sampled Plano residential |
| `4801 W Park` | `4801 W Park Dr, Austin, TX` | `premise` | Sampled Austin residential |
| `the reserve walnut` | `The Reserve at Walnut Creek` (Exchange Drive, Austin, TX) | `point_of_interest` + `establishment` (`apartment_complex`) | Apartment complex by name — common Texas multifamily signup pattern |

## Sanity cases (must continue to return useful results)

These already worked before; included to catch silent regressions if the filter
is narrowed in the future.

| Input | Acceptance criteria |
|---|---|
| `100 main street, austin tx` | At least one Austin-area result with a numbered street |
| `123 Elm` | At least one Austin-area Elm-named street |
| `5400 Tarry` | `5400 Tarryhollow Drive, Austin, TX` present |
| `100` (numeric only) | Non-empty result list of premise/subpremise/street_address |

## Non-goals (intentionally excluded types)

`route` and `geocode` are intentionally NOT in `includedPrimaryTypes`:

- **`route`** — returns a Place ID for a road, not a numbered address. Selecting
  one yields no house number; downstream Address Validation cannot resolve to a
  deliverable service location.
- **`geocode`** in the new Places API is a leaf Table B type for
  interpolated / ungrounded geocode results (NOT the legacy collection that
  encompassed `street_address` / `route` / `premise`). Selections may not pin to
  a discrete address. See
  https://developers.google.com/maps/documentation/places/web-service/place-types
  Tables A/B/C.

If a future bug surfaces an address that Google only classifies as `route`,
revisit by swapping one of the 5 slots (max budget) — do not silently add a 6th.

## How to re-run

```sh
# Use the dev key from .env.development, or any key with Places API (New) enabled.
export GOOGLE_API_KEY=...

curl -s -X POST 'https://places.googleapis.com/v1/places:autocomplete' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_API_KEY" \
  -d '{
    "input": "2740 castlebridge",
    "languageCode": "en",
    "includedPrimaryTypes": ["street_address", "premise", "subpremise", "point_of_interest", "establishment"]
  }' \
  | python3 -c "import json,sys
for s in json.load(sys.stdin).get('suggestions', []):
    p = s.get('placePrediction', {})
    print(p.get('text', {}).get('text', ''), '->', p.get('types', []))"
```

Repeat with each `input` from the tables above. A passing run is one where
every "must include" row appears in the corresponding response.
