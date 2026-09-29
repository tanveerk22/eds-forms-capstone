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
the 3 doc-based sheet JSONs) are also authored/pushed as real documents in
**Document Authoring (DA / da.live)**, browsable and editable at
`https://da.live/#/tanveerk22/eds-forms-capstone`:

```
/index.html, /nav.html, /footer.html
/fragments/otp-login.html, /fragments/offer-display.html, /fragments/preview.html
/forms/otp-login.json, /forms/offer-display.json, /forms/preview.json
```

`fstab.yaml` declares the content-source mountpoint
(`https://content.da.live/tanveerk22/eds-forms-capstone/`) that a real
cloud-delivered EDS site would fetch this content from. These were pushed
using the AEM CLI's DA workflow: `aem content clone/add/commit/push` (a
git-like local staging flow — `content/` is a gitignored working mirror,
never committed to the code repo, matching standard EDS convention where
content lives in DA, not in git).

**Note:** local `npx aem up` and any current `aem.page`/`aem.live` URLs
still serve straight from the repo's static files (verified this does not
regress — local dev prioritizes repo files over the DA mount). Making the
*live* site actually fetch from DA end-to-end additionally requires
installing the AEM Code Sync GitHub App on the repo (a repo/org-level
action outside this session's scope) — without it, `admin.hlx.page`
preview/publish calls 404. DA itself already has and serves the real
content today (verified via `content.da.live` + the DA admin `list` API).

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
Implemented in `scripts/loan-journey.js` → `calculateEmi()`, using the
standard reducing-balance EMI formula from the capstone spec:

```
EMI = P × r × (1 + r)ⁿ / ((1 + r)ⁿ − 1)
  P = principal (loan amount)
  r = monthly interest rate = (annual rate / 12) / 100
  n = tenure in months
```

Verified against the spec's worked example: **P = ₹5,00,000, rate = 12% p.a.,
n = 36 months → EMI = ₹16,607/month** (confirmed via automated Playwright
test against the running app). EMI recalculates live as the customer edits
Loan Amount / Tenure on the Offer step, bounded by the offer amount and max
tenure (client-side validation).

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
  Sheet/Excel workbook. The JSON shape is identical to what the EDS pipeline
  produces, so migrating to a real spreadsheet source is a content-only
  change (no code changes required).
- **DOB/PAN visibility toggling** is implemented in `loan-journey.js`
  (reacting to the identifier radio group) rather than via the sheet's
  native `Visible Expression` authoring column, because hand-computing
  correct spreadsheet cell references without a live spreadsheet UI was
  judged too error-prone within the capstone's time-box. In a live AEM
  Forms Author environment this would move to the visual Rule Editor
  (no code).
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
