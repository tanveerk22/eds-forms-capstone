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
// ---------------------------------------------------------------------
/** EMI = P * r * (1+r)^n / ((1+r)^n - 1), where r = monthly interest rate. */
function calculateEmi(principal, annualRatePct, tenureMonths) {
  const r = annualRatePct / 12 / 100;
  if (!principal || !tenureMonths || r <= 0) return 0;
  const factor = (1 + r) ** tenureMonths;
  return Math.round((principal * r * factor) / (factor - 1));
}

function recalculateEmi() {
  const loanAmount = Number(document.getElementById('loan-amount')?.value || 0);
  const tenure = Number(document.getElementById('tenure')?.value || 0);
  const { rateOfInterest = 0 } = getState();
  const emi = calculateEmi(loanAmount, rateOfInterest, tenure);
  const emiField = document.getElementById('emi');
  if (emiField) emiField.value = emi || '';
}

function populateOfferStep() {
  const {
    customerName, offerAmount, rateOfInterest, maxTenure,
  } = getState();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('customer-name', customerName);
  set('offer-amount', offerAmount);
  set('rate-of-interest', rateOfInterest);
  set('max-tenure', maxTenure);
  set('loan-amount', offerAmount);
  set('tenure', maxTenure);
  recalculateEmi();
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
// ---------------------------------------------------------------------
function toggleIdentifierFields() {
  const selected = document.querySelector('input[name="identifier-type"]:checked')?.value;
  setFieldVisible('dob', selected !== 'PAN');
  setFieldVisible('pan-number', selected === 'PAN');
}

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

document.addEventListener('change', (e) => {
  if (e.target.name === 'identifier-type') {
    toggleIdentifierFields();
  } else if (e.target.id === 'loan-amount' || e.target.id === 'tenure') {
    recalculateEmi();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'loan-amount' || e.target.id === 'tenure') {
    recalculateEmi();
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
