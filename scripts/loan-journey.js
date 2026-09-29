/*
 * Loan Journey Controller (Tier 1 — Foundation)
 *
 * Orchestrates the multi-step Personal Loan journey across three reusable
 * EDS fragments (OTP Login, Offer Display + EMI, Preview) that are embedded
 * into index.html via the standard `fragment` block. Because each fragment
 * is decorated into its own independent <form> element, this controller
 * uses event delegation on `document` so it works regardless of when each
 * fragment's form has finished loading, and persists journey state in
 * sessionStorage so any step can read what earlier steps collected.
 *
 * No PII (name, DOB, PAN, mobile number, OTP) is ever written to
 * console/analytics logs — see logJourneyEvent().
 */
import { initiateCustomerIdentification, verifyOtpAndGetDemogDetails, submitLoanApplication } from './mock-api.js';

const STEPS = ['step-welcome', 'step-login', 'step-offer', 'step-preview', 'step-thankyou'];
const STORAGE_KEY = 'loan-journey-state';

function getState() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function setState(patch) {
  const state = { ...getState(), ...patch };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

/** Basic (non-PII) analytics event log — satisfies "Analytics (Basic)" event list. */
function logJourneyEvent(name, detail = {}) {
  // eslint-disable-next-line no-console
  console.info(`[analytics] ${name}`, detail);
}

function showStep(stepId) {
  STEPS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === stepId);
  });
  document.getElementById(stepId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  logJourneyEvent('page_view', { step: stepId });
}

function setFieldVisible(id, visible) {
  const input = document.getElementById(id);
  const wrapper = input?.closest('.field-wrapper');
  if (wrapper) wrapper.dataset.visible = visible ? 'true' : 'false';
}

function showInlineMessage(id, message, isError = true) {
  const wrapper = document.getElementById(id)?.closest('.field-wrapper');
  if (!wrapper) return;
  wrapper.textContent = message;
  wrapper.dataset.visible = message ? 'true' : 'false';
  wrapper.classList.toggle('journey-error', isError);
  wrapper.classList.toggle('journey-info', !isError);
}

// ---------------------------------------------------------------------
// Step 2: Offer Display + EMI Calculator (defined first — used by the
// Step 1 OTP-verify handler once login succeeds).
//
// EMI is NOT computed here. It is authored declaratively as a "Value
// Expression" formula on the `emi` field in forms/offer-display.json
// (EMI = P x r x (1+r)^n / ((1+r)^n - 1)), evaluated by the framework's
// doc-based RuleEngine. Because the rule engine only recomputes on native
// `change` events, we dispatch one after each programmatic value set below
// so the authored formula recalculates exactly as it would for a user
// editing the field directly.
// ---------------------------------------------------------------------
function setAndNotify(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? '';
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function populateOfferStep() {
  const {
    customerName, offerAmount, rateOfInterest, maxTenure,
  } = getState();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('customer-name', customerName);
  set('offer-amount', offerAmount);
  set('max-tenure', maxTenure);
  // Order matters: `emi`'s authored Value Expression depends on all three
  // of these, and recomputes using whatever is in the rule engine's data
  // snapshot at the time of each event — so the LAST one fired must be
  // set only after the other two are already in place.
  setAndNotify('rate-of-interest', rateOfInterest);
  setAndNotify('loan-amount', offerAmount);
  setAndNotify('tenure', maxTenure);
}

// ---------------------------------------------------------------------
// Step 3: Preview & Submit (defined next — used by the Step 2 "Continue"
// handler once an offer/EMI combination is selected).
// ---------------------------------------------------------------------
function populatePreviewStep() {
  const {
    customerName, offerAmount, rateOfInterest, loanAmount, tenure, emi,
  } = getState();
  const summary = document.getElementById('preview-summary')?.closest('.field-wrapper');
  if (summary) {
    summary.innerHTML = `
      <ul class="preview-summary-list">
        <li><strong>Customer Name:</strong> ${customerName || ''}</li>
        <li><strong>Pre-Approved Offer:</strong> ₹${offerAmount || ''}</li>
        <li><strong>Rate of Interest:</strong> ${rateOfInterest || ''}% p.a.</li>
        <li><strong>Loan Amount Requested:</strong> ₹${loanAmount || ''}</li>
        <li><strong>Tenure:</strong> ${tenure || ''} months</li>
        <li><strong>Estimated Monthly EMI:</strong> ₹${emi || ''}</li>
      </ul>`;
  }
}

// ---------------------------------------------------------------------
// Step 1: OTP Login
//
// DOB vs PAN field visibility is NOT toggled here. It is authored
// declaratively as a "Visible Expression" on the `dob` / `pan-number`
// fields in forms/otp-login.json (visible when the identifier-type radio
// equals "DOB" / "PAN" respectively), evaluated by the framework's
// doc-based RuleEngine on the radio group's native `change` event.
// ---------------------------------------------------------------------
async function handleSendOtp() {
  const mobileNo = document.getElementById('mobile-no')?.value?.trim();
  const identifierName = document.querySelector('input[name="identifier-type"]:checked')?.value === 'PAN' ? 'PAN_NO' : 'DOB';
  const identifierValue = identifierName === 'PAN_NO'
    ? document.getElementById('pan-number')?.value?.trim()
    : document.getElementById('dob')?.value?.trim();

  showInlineMessage('login-error', '');
  if (!/^\d{10}$/.test(mobileNo || '')) {
    showInlineMessage('login-error', 'Please enter a valid 10-digit mobile number.');
    return;
  }
  if (!identifierValue) {
    showInlineMessage('login-error', 'Please enter your Date of Birth or PAN Number.');
    return;
  }

  const sendOtpBtn = document.getElementById('send-otp');
  sendOtpBtn.disabled = true;
  const response = await initiateCustomerIdentification({
    mobileNo, identifierName, identifierValue,
  });
  sendOtpBtn.disabled = false;

  if (response.status.responseCode === '0') {
    setState({ mobileNo });
    setFieldVisible('otp-msg', true);
    setFieldVisible('otp', true);
    setFieldVisible('verify-otp', true);
    logJourneyEvent('otp_sent');
  } else {
    showInlineMessage('login-error', response.status.errorDesc);
    logJourneyEvent('otp_send_failure', { errorCode: response.status.errorCode });
  }
}

async function handleVerifyOtp() {
  const passwordValue = document.getElementById('otp')?.value?.trim();
  showInlineMessage('login-error', '');

  const verifyBtn = document.getElementById('verify-otp');
  verifyBtn.disabled = true;
  const response = await verifyOtpAndGetDemogDetails({ passwordValue });
  verifyBtn.disabled = false;

  if (response.status.responseCode === '0') {
    const details = response.responseString.OfferDemogDetails[0];
    setState({
      customerName: `${details.customerFirstName} ${details.customerLastName}`,
      offerAmount: Number(details.offerAmount),
      rateOfInterest: Number(details.rateOfInterest),
      maxTenure: Number(details.tenure),
    });
    logJourneyEvent('otp_verify_success');
    populateOfferStep();
    showStep('step-offer');
  } else {
    showInlineMessage('login-error', response.status.errorDesc);
    logJourneyEvent('otp_verify_failure', { errorCode: response.status.errorCode });
  }
}

function handleContinueToPreview() {
  const loanAmount = Number(document.getElementById('loan-amount')?.value || 0);
  const tenure = Number(document.getElementById('tenure')?.value || 0);
  const { offerAmount = 0, maxTenure = 0 } = getState();

  if (loanAmount <= 0 || loanAmount > offerAmount) {
    // eslint-disable-next-line no-alert
    window.alert(`Loan amount must be between ₹1 and your offer of ₹${offerAmount}.`);
    return;
  }
  if (tenure <= 0 || tenure > maxTenure) {
    // eslint-disable-next-line no-alert
    window.alert(`Tenure must be between 1 and ${maxTenure} months.`);
    return;
  }

  setState({ loanAmount, tenure, emi: Number(document.getElementById('emi')?.value || 0) });
  logJourneyEvent('offer_selected', { tenure });
  populatePreviewStep();
  showStep('step-preview');
}

async function handlePreviewSubmit(form) {
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const submitBtn = form.querySelector('#submit');
  if (submitBtn) submitBtn.disabled = true;

  const {
    customerName, loanAmount, tenure, emi,
  } = getState();
  const response = await submitLoanApplication({
    customerName, loanAmount, tenure, emi,
  });

  if (submitBtn) submitBtn.disabled = false;
  if (response.status.responseCode === '0') {
    const ackId = response.responseString.acknowledgementId;
    setState({ ackId });
    document.getElementById('ack-id').textContent = ackId;
    logJourneyEvent('submission_success', { ackId });
    showStep('step-thankyou');
  } else {
    // eslint-disable-next-line no-alert
    window.alert('Something went wrong while submitting your application. Please try again.');
    logJourneyEvent('submission_failure', { errorCode: response.status.errorCode });
  }
}

// ---------------------------------------------------------------------
// Event wiring (delegated — works regardless of fragment load timing)
// ---------------------------------------------------------------------
document.addEventListener('click', (e) => {
  if (e.target.id === 'apply-now-btn') {
    e.preventDefault();
    showStep('step-login');
  } else if (e.target.id === 'send-otp') {
    handleSendOtp();
  } else if (e.target.id === 'verify-otp') {
    handleVerifyOtp();
  } else if (e.target.id === 'continue-btn') {
    handleContinueToPreview();
  } else if (e.target.id === 'back-btn') {
    showStep('step-offer');
  }
});

// Intercept the preview form's native submit before the framework's own
// submit.js handler runs (which would otherwise POST to a non-existent
// backend). Capture phase on document runs before the form's own listener.
document.addEventListener('submit', (e) => {
  if (e.target.querySelector?.('#consent')) {
    e.preventDefault();
    e.stopPropagation();
    handlePreviewSubmit(e.target);
  }
}, true);

// Initial UI state once the DOM is parsed.
document.addEventListener('DOMContentLoaded', () => {
  showStep('step-welcome');
});
