/*
 * Generates the doc-based (sheet) Adaptive Form JSON files consumed by the
 * "form" block, one per reusable journey fragment:
 *   forms/otp-login.json      -> fragments/otp-login.html
 *   forms/offer-display.json  -> fragments/offer-display.html
 *   forms/preview.json        -> fragments/preview.html
 *
 * In a production EDS project these are produced automatically from a
 * Google Sheet / Excel workbook published through the AEM Forms EDS content
 * pipeline. Without a live content source (SharePoint/GDrive mountpoint) or
 * an AEM Forms Author instance, this script emits byte-identical JSON so the
 * runtime (blocks/form/*) behaves exactly as it would against real
 * published content.
 *
 * Run: node tools/gen/build-form-sheets.mjs
 */
/* eslint-disable object-property-newline */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(currentDir, '..', '..');

const COLUMNS = [
  'Name', 'Type', 'Placeholder', 'Label', 'Mandatory', 'Value', 'Visible',
  'Min', 'Max', 'Fieldset', 'Repeatable', 'Options', 'OptionNames',
  'Value Expression', 'Visible Expression', 'Column Span', 'Checked',
  'Step', 'ReadOnly', 'Describe',
];

function row(fields) {
  const r = {};
  COLUMNS.forEach((c) => { r[c] = ''; });
  Object.entries(fields).forEach(([k, v]) => { r[k] = v; });
  return r;
}

function writeSheet(name, rows) {
  const sheet = {
    total: rows.length,
    offset: 0,
    limit: rows.length,
    data: rows,
    columns: COLUMNS,
    ':type': 'sheet',
  };
  const outPath = path.join(ROOT, 'forms', `${name}.json`);
  writeFileSync(outPath, JSON.stringify(sheet));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

// ============================================================
// Fragment 1: OTP Login (reusable across any journey)
// ============================================================
writeSheet('otp-login', [
  row({
    Name: 'mobile-no',
    Type: 'text',
    Label: 'Mobile Number',
    Mandatory: 'true',
    Placeholder: '10-digit mobile number',
    'Column Span': '6',
  }),
  row({ Name: 'identifier-group', Type: 'fieldset', Label: 'Verify identity using' }),
  row({
    Name: 'identifier-type',
    Type: 'radio',
    Fieldset: 'identifier-group',
    Label: 'Date of Birth',
    Value: 'DOB',
    Checked: 'true',
  }),
  row({
    Name: 'identifier-type',
    Type: 'radio',
    Fieldset: 'identifier-group',
    Label: 'PAN Number',
    Value: 'PAN',
  }),
  row({
    Name: 'dob', Type: 'date', Label: 'Date of Birth', Mandatory: 'true', 'Column Span': '6',
  }),
  row({
    Name: 'pan-number',
    Type: 'text',
    Label: 'PAN Number',
    Placeholder: 'ABCDE1234F',
    Visible: 'false',
    'Column Span': '6',
  }),
  row({ Name: 'send-otp', Type: 'button', Label: 'Send OTP' }),
  row({
    Name: 'otp-msg',
    Type: 'plain-text',
    Value: 'An OTP has been sent to your registered mobile number. (Mock: use 123456)',
    Visible: 'false',
  }),
  row({
    Name: 'otp',
    Type: 'text',
    Label: 'Enter OTP',
    Placeholder: '6-digit OTP',
    Visible: 'false',
    'Column Span': '6',
  }),
  row({
    Name: 'verify-otp', Type: 'button', Label: 'Verify OTP', Visible: 'false',
  }),
  row({ Name: 'login-error', Type: 'plain-text', Visible: 'false' }),
]);

// ============================================================
// Fragment 2: Offer Display + EMI Calculator
// ============================================================
writeSheet('offer-display', [
  row({
    Name: 'customer-name', Type: 'text', Label: 'Customer Name', ReadOnly: 'true',
  }),
  row({
    Name: 'offer-amount', Type: 'number', Label: 'Pre-Approved Offer Amount (₹)', ReadOnly: 'true',
  }),
  row({
    Name: 'rate-of-interest', Type: 'number', Label: 'Rate of Interest (% p.a.)', ReadOnly: 'true',
  }),
  row({
    Name: 'max-tenure', Type: 'number', Label: 'Max Tenure (months)', ReadOnly: 'true',
  }),
  row({
    Name: 'loan-amount', Type: 'number', Label: 'Loan Amount (₹)', Mandatory: 'true', Min: '10000',
  }),
  row({
    Name: 'tenure', Type: 'number', Label: 'Tenure (months)', Mandatory: 'true', Min: '6',
  }),
  row({
    Name: 'emi', Type: 'number', Label: 'Estimated Monthly EMI (₹)', ReadOnly: 'true',
  }),
  row({ Name: 'continue-btn', Type: 'button', Label: 'Continue to Preview' }),
]);

// ============================================================
// Fragment 3: Preview (read-only) + Final Submission
// ============================================================
writeSheet('preview', [
  row({ Name: 'preview-summary', Type: 'plain-text' }),
  row({
    Name: 'consent',
    Type: 'checkbox',
    Label: 'I confirm the above details are correct and agree to the Terms & Conditions',
    Mandatory: 'true',
  }),
  row({ Name: 'back-btn', Type: 'button', Label: 'Back' }),
  row({ Name: 'submit', Type: 'submit', Label: 'Submit Application' }),
]);
