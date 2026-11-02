# Capstone Submission Note — Tier 1 Personal Loan Journey (AEM Forms EDS)

**Repo:** `tanveerk22/eds-forms-capstone`, branch `eds-forms` (PR #3)
**Live URL:** https://eds-forms--eds-forms-capstone--tanveerk22.aem.page/
**Authoring (da.live):** https://da.live/edit#/tanveerk22/eds-forms-capstone/index

## Journey Built
5-step single-page Tier 1 journey: **Welcome → OTP Login → Loan Offer & EMI → Preview → Thank You**

## Forms Built (doc-based/sheet Adaptive Forms, 3 reusable fragments)

| Fragment | Sheet | Purpose |
|---|---|---|
| `fragments/otp-login` | `forms/otp-login.json` | Mobile number + DOB/PAN identity verification, OTP send/verify |
| `fragments/offer-display` | `forms/offer-display.json` | Pre-approved offer display + live EMI calculator |
| `fragments/preview` | `forms/preview.json` | Read-only application preview, consent, submit |

Each fragment is an independent doc-based form sheet (Name/Type/Label/Mandatory/Visible/Value Expression columns), embeddable unmodified in any journey via the standard EDS `fragment` block.

## Authoring Approach

- **Doc-based (sheet) Adaptive Forms** — no AEM Forms Author instance was available, so sheets were hand-authored as JSON matching the exact shape a published Excel/Google Sheet produces (drop-in replaceable later, zero code change).
- **Rules authored as formulas, not JavaScript:**
  - DOB/PAN field visibility: `Visible Expression` = `=F4="DOB"` / `=F4="PAN"` on the identifier-type radio.
  - EMI calculation: `Value Expression` = `=ROUND(F6*(F4/1200)*POWER(1+(F4/1200),F7)/(POWER(1+(F4/1200),F7)-1),0)`, evaluated live by the framework's own doc-based RuleEngine.
- **Full Document Authoring (da.live) setup:** all 9 content docs (shell page, nav, footer, 3 fragments, 3 sheets) authored and pushed to DA; `fstab.yaml` mounts the content source; AEM Code Sync GitHub App installed so the live `eds-forms` branch resolves content from DA + code from GitHub end-to-end (not just local dev).
- Page shell uses standard EDS conventions throughout (Fragment block, Section Metadata block for step identification) to survive DA's content round-trip.

## APIs Integrated (mocked per spec, in `scripts/mock-api.js`)

| API | Purpose | Contract |
|---|---|---|
| `InitiateCustomerIdentification` | Send OTP + check offer availability | Exact request/response shape from capstone API reference; happy + failure paths (`ERR_NO_OFFER`) |
| `VerifyOTPAndGetDemogDetails` | Validate OTP, fetch customer + offer demographics | Happy + failure paths (`ERR_INVALID_OTP`) |
| Submission (mock) | Final application submit | Returns `acknowledgementId` |

Swapping to real backend = implementing the `fetch()` inside each mock function only; all calling code/contracts already match production shape.

## Analytics

8 non-PII events logged (`page_view`, `otp_sent`, `otp_send_failure`, `otp_verify_success`, `otp_verify_failure`, `offer_selected`, `submission_success`, `submission_failure`).

## Production Debugging — Issues Found & Fixed

While verifying the live `aem.page` URL matched local dev behaviour, three production-specific bugs were found and fixed (all invisible locally, since local `npx aem up` serves repo static files directly and bypasses the DA content pipeline):

1. **`head.html`** (the shared production `<head>` template) was missing `scripts/loan-journey.js` and `styles/loan-journey.css` — it only referenced `aem.js`/`scripts.js`/`styles.css`. Fixed by adding both tags.
2. **DA's content-authoring round-trip strips arbitrary custom `id` attributes** from generic content divs — only recognized block markup survives. The step-section navigation relied on hand-authored `id="step-x"` attributes, which broke in production. Fixed by identifying each step via an authored **Section Metadata** block (`Style = step-welcome` / `step-login` / etc.), which does survive the DA round-trip, and updating `loan-journey.js`/CSS to select steps by that class instead of by id. The "Apply Now" link and "Acknowledgement ID" placeholder are now located by text match instead of a stripped id.
3. **Fragment pages in DA were missing the standard `<body><header><main>...</main><footer></footer></body>` wrapper** (they were bare `<div>` snippets). DA's pipeline mis-parses content without this wrapper and silently collapsed the `class="form"` block reference down to a plain link, breaking all 3 embedded forms live. Fixed by wrapping each fragment page the same way `index.html` is wrapped.

All three fixes were verified by running the full Tier 1 journey with Playwright directly against the live `aem.page` URL — not just local `npx aem up`, which no longer reliably predicts production behaviour for this project once DA + Code Sync are active.

## Known Limitation — `forms/*.json` not visually editable in da.live's Sheet UI

Per the official [AEM EDS "Spreadsheets and JSON"](https://www.aem.live/developer/spreadsheets) doc, the recommended authoring pattern is: author data as a real spreadsheet (Excel/Google Sheet, or a da.live Sheet document), and let AEM's pipeline auto-convert it to this JSON shape on preview/publish. Our 3 `forms/*.json` files were instead generated locally (`tools/gen/build-form-sheets.mjs`) and pushed directly as final JSON via DA's [Source API](https://docs.da.live/developers/api/source) — which DA's own docs confirm is a valid, supported way to create `":type":"sheet"`-shaped JSON files (our output matches that spec exactly, including the `columns` array and `:type` marker). This was a deliberate workaround since no AEM Forms Author / published spreadsheet source was available (see `DELIVERABLES.md` §5).

**Net effect:** the forms run correctly in production (verified above) and the JSON is spec-compliant, but opening `da.live/sheet#/.../forms/<name>` shows a blank grid — da.live's interactive Sheet *editor* only renders documents created through its own "+ Create > Sheet" flow (which wires up a live collaborative editing session), not arbitrary JSON pushed via the Source API. The `/config/{org}/{repo}/` 404 seen in the browser network tab is unrelated/benign — it's just an optional site-wide config document (see [Config API](https://docs.da.live/developers/api/config)) that this project never created.

**To make a sheet visually editable in da.live** (not required for the forms to function, only for future spreadsheet-style editing in the UI): in da.live, use **+ Create > Sheet** in the `forms/` folder, paste in the same column headers and rows, then it can be edited live and will publish to the same `.json` path/shape our code already expects — no code changes needed either way.

## Validation

- Verified end-to-end via Playwright against the **live production URL**: EMI = ₹16,607 for the ₹5L / 12% / 36-month worked example, matching spec exactly.
- 249 unit tests passing.
- Lint clean (no new warnings/errors introduced).

## Key Files Reference

| File | Purpose |
|---|---|
| `index.html` | Journey shell (5 steps), also mirrored into DA |
| `fragments/*.plain.html`, `forms/*.json` | Reusable form fragments + sheets |
| `scripts/loan-journey.js` | Step navigation, business logic, state hand-off |
| `scripts/mock-api.js` | Mocked backend API contracts |
| `styles/loan-journey.css` | Journey-specific styling |
| `tools/gen/build-form-sheets.mjs` | Generator for the sheet JSONs (incl. authored formulas) |
| `fstab.yaml` | DA content-source mountpoint declaration |
| `head.html` | Shared production `<head>` template |
| `DELIVERABLES.md` | Full detailed write-up (this note is the condensed version) |
