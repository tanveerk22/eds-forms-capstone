# Tier 1 Capstone Deliverables — Personal Loan Journey (AEM Forms EDS)

## 1. Working Forms Journey
A single-page, five-step Personal Loan application journey built on the AEM
Forms EDS **doc-based (sheet) Adaptive Form** engine:

`Welcome → OTP Login → Loan Offer & EMI → Preview → Thank You`

- **Entry point:** `index.html`
- **Reusable fragments** (each its own EDS `fragment` block + independent
  doc-based Adaptive Form, so any new journey can embed them unmodified):
  - `fragments/otp-login.*` → `forms/otp-login.json` — Mobile + DOB/PAN OTP login
  - `fragments/offer-display.*` → `forms/offer-display.json` — Offer + EMI calculator
  - `fragments/preview.*` → `forms/preview.json` — Read-only preview + submit
- **Header/Footer fragments:** `nav.plain.html`, `footer.plain.html`
- **Orchestration:** `scripts/loan-journey.js` (step navigation, field
  visibility toggling, EMI calc, sessionStorage state hand-off between
  fragments) + `scripts/mock-api.js` (mocked backend calls)
- **Styling:** `styles/loan-journey.css`

Run locally with `npm i && npx aem up`, then open `http://localhost:3000/`.

## 1a. Document Authoring (da.live)
All 9 content documents (the journey page, 3 fragments, header, footer, and
the 3 doc-based sheet JSONs) are authored and live in
**Document Authoring (DA / da.live)**, browsable/editable at
`https://da.live/#/tanveerk22/eds-forms-capstone` (edit mode:
`https://da.live/edit#/tanveerk22/eds-forms-capstone/index`):

```
/index.html, /nav.html, /footer.html
/fragments/otp-login.html, /fragments/offer-display.html, /fragments/preview.html
/forms/otp-login.json, /forms/offer-display.json, /forms/preview.json
```

`fstab.yaml` declares the content-source mountpoint
(`https://content.da.live/tanveerk22/eds-forms-capstone/`), and the
**AEM Code Sync GitHub App** is installed on the repo, so the `eds-forms`
branch is live end-to-end at
`https://eds-forms--eds-forms-capstone--tanveerk22.aem.page/` — content
served from DA, code (scripts/styles/blocks) served from GitHub.

**Production-specific issues found and fixed while making the live site
match local behaviour:**
- `head.html` (the shared production `<head>` template) only referenced
  `aem.js`/`scripts.js`/`styles.css` — it was missing
  `scripts/loan-journey.js` and `styles/loan-journey.css` entirely. Locally
  this was masked because the repo's own `index.html` carries its own
  `<head>` and is served directly, bypassing `head.html`. **Fixed** by
  adding both tags to `head.html`.
- DA's content-authoring round-trip **strips arbitrary custom `id`
  attributes** from generic content divs (only recognized block markup
  survives). Our step-section navigation previously relied on hand-authored
  `id="step-x"` attributes — broken in production. **Fixed** by identifying
  each step via an authored **Section Metadata** block (`Style` =
  `step-welcome`/`step-login`/etc.), which *does* survive the DA round-trip,
  and updating `loan-journey.js`/`loan-journey.css` to select steps by that
  class instead of by id. The "Apply Now" link and the "Acknowledgement ID"
  placeholder (plain content, not form fields) are now located by text match
  instead of a stripped id.
- The three fragment pages (`content/fragments/*.html`) were missing the
  standard `<body><header></header><main>...</main><footer></footer></body>`
  wrapper (they were bare `<div>` snippets). DA's pipeline mis-parses content
  without this wrapper and silently collapsed the `class="form"` block
  reference down to a plain link, breaking all three embedded forms in
  production (while working fine locally, since local dev serves the repo's
  already-correct static `.plain.html` files directly). **Fixed** by wrapping
  each fragment page the same way `index.html` is wrapped.

All of the above were verified by running the full Tier 1 journey with
Playwright directly against the live `aem.page` URL (not just local
`npx aem up`, which no longer reliably predicts production behaviour for
this project since production always resolves content from DA + `head.html`,
regardless of matching static repo files).

## 2. API / FDM Configuration Summary
No AEM Forms Author instance or live SOA/API Gateway was available for this
capstone, so the two Tier‑1 APIs are mocked in `scripts/mock-api.js` using
the **exact request/response contracts** from the capstone API reference:

| API | Purpose | Happy path | Failure path |
|---|---|---|---|
| `InitiateCustomerIdentification` | Sends OTP, checks offer availability | Any 10-digit mobile + DOB/PAN → `responseCode: "0"`, `offerAvailable: "Y"` | Mobile number starting with `0` → `responseCode: "1"`, `errorCode: ERR_NO_OFFER` |
| `VerifyOTPAndGetDemogDetails` | Validates OTP, returns customer + offer demographics | OTP `123456` → `responseCode: "0"` + `OfferDemogDetails` | Any other OTP → `responseCode: "2"`, `errorCode: ERR_INVALID_OTP` |
| Final submission (mock) | Submits application | Always succeeds → returns `acknowledgementId` | N/A for Tier 1 (submission failure handling is a Tier 2 concern per spec) |

Swapping in the real bank APIs is a drop-in change: only the `fetch()` call
inside each function in `mock-api.js` needs to be implemented — the
request/response shapes, and all calling code in `loan-journey.js`, already
match the production contract.

**FDM / field mapping:** each doc-based form (`forms/*.json`) plays the role
of the FDM-mapped field list — column headers `Name/Type/Label/Mandatory/
Visible/ReadOnly/...` mirror how a real Excel/Google Sheet is published
through the EDS content pipeline into an Adaptive Form field definition.

## 3. EMI Calculation Explanation
Implemented as an **authored `Value Expression` formula** on the `emi`
field in `forms/offer-display.json` (not JavaScript), using the standard
reducing-balance EMI formula from the capstone spec:

```
EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)
  P = principal (loan amount)
  r = monthly interest rate = (annual rate / 12) / 100
  n = tenure in months
```

Authored as (doc-based formula grammar, row numbers refer to the sheet's
data rows for `rate-of-interest`, `loan-amount`, `tenure`):
```
=ROUND(F6*(F4/1200)*POWER(1+(F4/1200),F7)/(POWER(1+(F4/1200),F7)-1),0)
```
Evaluated by the framework's own doc-based `RuleEngine` — the same engine
that would run against a real published spreadsheet in production.

Verified against the spec's worked example: **P = ₹5,00,000, rate = 12% p.a.,
n = 36 months → EMI = ₹16,607/month** (confirmed via automated Playwright
test against the running app). EMI recalculates live as the customer edits
Loan Amount / Tenure on the Offer step, bounded by the offer amount and max
tenure (client-side validation), and also recalculates when the mocked
API populates the initial offer.

## 4. Analytics Events List (Basic)
Logged via `logJourneyEvent()` (console-based stub; no PII is ever logged):

| Event | Fired when |
|---|---|
| `page_view` | Each step becomes active (`{ step }`) |
| `otp_sent` | OTP successfully generated |
| `otp_send_failure` | Identification/offer check fails (`{ errorCode }`) |
| `otp_verify_success` | OTP verified, customer/offer fetched |
| `otp_verify_failure` | Wrong OTP entered (`{ errorCode }`) |
| `offer_selected` | Customer confirms loan amount/tenure (`{ tenure }`) |
| `submission_success` | Application submitted (`{ ackId }`) |
| `submission_failure` | Submission failed (`{ errorCode }`) |

## 5. Known Limitations & Improvement Ideas
- **No AEM Forms Author / Cloud Service access** was available for this
  capstone, so field authoring uses hand-authored sheet JSON
  (`tools/gen/build-form-sheets.mjs`) instead of a real published Google
  Sheet/Excel workbook. The JSON shape — including the `Visible Expression`
  / `Value Expression` formula columns described below — is identical to
  what the EDS pipeline produces, so migrating to a real spreadsheet source
  is a content-only change (no code changes required).
- **DOB/PAN visibility** and **EMI calculation** are both implemented as
  genuine **authoring rules**, not JavaScript:
  - `forms/otp-login.json` — `dob`/`pan-number` fields carry a
    `Visible Expression` (`=F4="DOB"` / `=F4="PAN"`) that toggles based on
    the `identifier-type` radio selection.
  - `forms/offer-display.json` — the `emi` field carries a
    `Value Expression` implementing the EMI formula
    (`=ROUND(F6*(F4/1200)*POWER(1+(F4/1200),F7)/(POWER(1+(F4/1200),F7)-1),0)`),
    evaluated by the framework's own doc-based `RuleEngine` whenever
    `rate-of-interest`, `loan-amount`, or `tenure` change — including when
    `scripts/loan-journey.js` populates them programmatically after the
    mocked OTP-verify API call (it sets the value then dispatches a native
    `change` event, exactly as a real user edit would). No EMI or
    visibility logic lives in JavaScript. In a live AEM Forms Author
    environment these formulas would instead be authored visually via the
    Rule Editor — the underlying JSON contract is unchanged.
- **OTP delivery, SMS gateway, and real KYC/eKYC/bureau calls** are
  entirely mocked — no real SMS is sent and no real bank systems are called.
- **No server-side validation / persistence** — everything runs client-side
  against mocked APIs; a production build needs a real backend integration
  layer and server-side re-validation of all inputs.
- **Retry/lockout policy** for repeated OTP failures (e.g., max attempts,
  cool-down) is not implemented — Tier 1 scope only requires one happy path
  + one failure path.
- **Accessibility & cross-browser testing** beyond the default boilerplate
  styling has not been performed.
- Tier 2/3 items (multi-API PAN/Bureau enquiry, offer persistence across
  reloads, richer analytics, async/callback handling) are explicitly out of
  scope for Tier 1 and are not implemented.
