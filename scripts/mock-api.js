/*
 * Mock backend for the Personal Loan journey (Tier 1 — Foundation).
 *
 * These functions stand in for the real HDFC Bank SOA/API Gateway services
 * described in the capstone API reference (InitiateCustomerIdentification,
 * VerifyOTPAndGetDemogDetails). Request/response shapes intentionally match
 * the sample payloads in the capstone spec so swapping in the real
 * endpoints later is a drop-in replacement — only the fetch() call in each
 * function needs to change from a mocked Promise to a real HTTP call.
 *
 * No PII is logged — see logJourneyEvent() in loan-journey.js.
 */

const NETWORK_DELAY_MS = 600;

function delay(value, ms = NETWORK_DELAY_MS) {
  return new Promise((resolve) => { setTimeout(() => resolve(value), ms); });
}

function contextParam(overrides = {}) {
  return {
    partnerId: 'HDFCBANK',
    channelID: 'ADOBE',
    productName: 'PL',
    partnerJourneyID: String(Date.now()),
    ...overrides,
  };
}

/**
 * Mock: InitiateCustomerIdentification
 * Happy path: any 10-digit mobile number succeeds and an offer is available.
 * Failure path: mobile numbers starting with "0" simulate a "no offer" / bank error response.
 */
export async function initiateCustomerIdentification({ mobileNo, identifierValue }) {
  const isFailure = !mobileNo || mobileNo.startsWith('0') || !identifierValue;
  if (isFailure) {
    return delay({
      contextParam: contextParam(),
      responseString: { offerAvailable: 'N', existingCustomer: 'N' },
      status: {
        responseCode: '1',
        errorCode: 'ERR_NO_OFFER',
        errorDesc: 'No pre-approved offer found for this customer.',
      },
    });
  }
  return delay({
    contextParam: contextParam({ bankJourneyID: String(Date.now() + 1) }),
    responseString: { offerAvailable: 'Y', existingCustomer: 'Y' },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  });
}

/**
 * Mock: VerifyOTPAndGetDemogDetails
 * Happy path: OTP "123456" succeeds and returns demographic + offer details.
 * Failure path: any other OTP value returns an OTP mismatch error.
 */
export async function verifyOtpAndGetDemogDetails({ passwordValue }) {
  if (passwordValue !== '123456') {
    return delay({
      contextParam: contextParam(),
      responseString: {},
      status: { responseCode: '2', errorCode: 'ERR_INVALID_OTP', errorDesc: 'The OTP entered is incorrect. Please try again.' },
    });
  }
  return delay({
    contextParam: contextParam(),
    responseString: {
      OfferDemogDetails: [{
        customerFirstName: 'Ankit',
        customerLastName: 'Shah',
        offerAmount: '500000.00',
        tenure: '36',
        rateOfInterest: '12.00',
        kycFlag: 'Y',
        customerID: 'XX12345',
      }],
    },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  });
}

/**
 * Mock: Final loan application submission.
 * Happy path always succeeds for Tier 1 (per capstone scope: one happy path + one failure case
 * is already covered at login/OTP; submission failure handling is a Tier 2 concern).
 */
export async function submitLoanApplication() {
  return delay({
    contextParam: contextParam(),
    responseString: {
      vkycLink: '',
      acknowledgementId: `ACK${Math.floor(100000 + Math.random() * 900000)}`,
    },
    status: { responseCode: '0', errorCode: '', errorDesc: '' },
  }, 900);
}
