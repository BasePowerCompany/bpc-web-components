# Address entry — design principles

These principles govern the address search + confirm flow. When a design decision is unclear, check it against these. If a UX change doesn't advance any of them, push back. If two principles conflict, the one higher in the list wins.

---

## 1. Submit in one motion; visible progress otherwise

The happy path is **type → select → redirect**, with no intermediate screens.

- When every signal is clean, submit silently — never show a modal "just to confirm."
- When we must block for async work (validation in flight, hydration fetching), show progress within 100ms. No invisible waits.
- Target: **P50 time from autocomplete-select to redirect under 1s** on the green path.

**Why:** Every extra click costs conversion. The modal exists to catch real problems, not to feel diligent.

---

## 2. Every warning answers *what we saw*, *why it matters*, *what to do*

No vague warnings. Every banner / field caption must contain:

- **What we saw** — the specific value or the component that's uncertain. *"We couldn't verify unit 134A"* beats *"this may be wrong."*
- **Why it matters, with examples** — orient the user. *"This is common for new builds and rural addresses."*
- **What to do** — an imperative verb. *Confirm. Edit. Add your unit.*

**Why:** "We couldn't verify this" without context trains users to ignore warnings. The modal loses credibility and real errors slip through.

---

## 3. Override is always one click away; hard blocks are last resort

The user is the source of truth, not Google. Our job is to surface risk, not to gatekeep.

- Every non-trivial warning has a **Confirm** path. No warnings that only offer "Edit."
- "Can't verify" is never a block. Only "can't parse" is — and even then the form stays editable.
- `missing_subpremise` must have an **equal-weight** escape (not a dismissed secondary link). Meter-level properties, SFHs flagged as multi-unit, and ADUs must all be able to proceed.

**Why:** Base's customer base includes rural, new-construction, and meter-per-structure properties that Google + USPS systematically mis-classify. Blocking these is blocking revenue.

---

## 4. Defer to the strongest signal we have

Stack validation signals by strength. When a stronger signal is clean, don't ask questions the weaker signal might flag.

Strength order (strongest first):
1. **USPS DPV=Y** — confirmed deliverable. Silent submit, regardless of any Google-layer flags.
2. **User confirmation via modal** — explicit intent. Don't re-ask downstream.
3. **Google `possibleNextAction=ACCEPT` with no unconfirmed components** — silent submit.
4. **Google component-level confirmation** — drives the modal kind.
5. **USPS DPV footnote** — tiebreaker for copy (new-build vs wrong-unit framing).

**Why:** If USPS says they'll deliver mail here, we have no business second-guessing Google's inference layer.

---

## 5. One modal, kind-aware

All confirm/warn/block states render in the **same modal component**. Only the copy, field highlights, and secondary actions vary by `kind`.

- Same layout, same field positions, same button positions, same dismissal behavior.
- Kind-specific copy lives in one `copyFor(kind)` switch, not scattered across components.
- A second visit to the modal looks and behaves like the first visit.

**Why:** Familiarity reduces cognitive load. Variant modals teach users nothing transferable.

---

## 6. Every decision emits an event

If the principles are working, we should be able to prove it from data.

Emit a PostHog event at every fork:
- `address_validation_result` — after classifying (both silent and modal paths)
- `address_validation_override` — user clicked Confirm / Edit / SFH
- `address_validation_dismiss` — user closed the modal

Each event includes the raw validation signals (`dpvConfirmation`, `unconfirmedComponentTypes`, `possibleNextAction`) plus what the user did. PostHog stamps every event with a timestamp, so latency between steps can be derived at query time — don't duplicate it as client-side fields.

**Key metrics to monitor:**
- Silent-submit rate (should rise after DPV=Y short-circuit)
- Modal shown rate, by kind
- Override rate per kind (if ~100%, the warning is noise — delete or soften)
- Dismiss-without-submit rate (abandonment signal)
- Time between `result` and `override` per kind (derived from event timestamps)

**Why:** We can't tune what we can't measure. A warning that's always overridden is friction without value.

---

## 7. Rural, new-build, and meter-per-structure are first-class

Base installs batteries in contexts Google + USPS don't always know about. The component must assume these cases exist — not treat them as errors.

- **Rural addresses** that USPS DPV can't confirm: framed as "common for rural addresses," not "invalid."
- **New construction** without USPS records: framed as "common for new builds," one-click confirm.
- **Meter-per-structure properties** (guest house, barn, pool pump, shop, trailer): acknowledged in the `confirm_subpremise` path, where the user has already typed something unusual and we shouldn't tell them they're wrong.

**Copy should match the likely user intent per kind:**

- `missing_subpremise` — dominant case is *"apartment dweller forgot the unit number."* Lead with that framing; the SFH escape button covers everything else (single-family, single-meter properties, etc.). Don't clutter the primary copy with barn/ADU examples.
- `confirm_subpremise` — user has already typed a value we couldn't verify. This is where meter-level framing belongs: *"that's okay for separate meters like guest houses, barns, or trailers."*

**Why:** These aren't edge cases — they're the ~7% of addresses that currently fail our SLA. But don't over-fit to the minority within that bucket: apartment-missing-unit is still the common case for `missing_subpremise`.

---

## Anti-principles (things we explicitly don't do)

- **Don't re-validate post-confirm.** Once the user confirms, the server shouldn't re-open the question.
- **Don't prompt to confirm `postal_code_suffix` inference.** Google adds ZIP+4 invisibly; user shouldn't see it.
- **Don't surface Google's `hasInferredComponents` as a warning.** It's usually harmless (ZIP+4 again). Surface only when a *substantive* component was inferred.
- **Don't gatekeep on `metadata.business`.** Residential-vs-commercial is the sales team's call, not the form's.
