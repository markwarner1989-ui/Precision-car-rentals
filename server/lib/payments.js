// ─────────────────────────────────────────────────────────────
// Cardknox / Sola payment integration
//
// This charges the FIXED category deposit at booking time.
// Card data should be collected on the frontend with Sola iFields
// (PCI-safe) which returns a one-time token ("xCardNum" = token).
// That token is what the frontend sends here — raw PANs never hit
// this server.
//
// Docs: https://docs.solapayments.com/api/transaction
// ─────────────────────────────────────────────────────────────

const MODE = process.env.PAYMENT_MODE || 'mock';
const API_URL = process.env.CARDKNOX_API_URL || 'https://x1.cardknox.com/gatewayjson';
const API_KEY = process.env.CARDKNOX_API_KEY || '';

/**
 * Charge a deposit.
 * @param {object} p
 * @param {number} p.amount        - deposit amount (USD)
 * @param {string} p.token         - Sola iFields payment token (xCardNum)
 * @param {string} p.exp           - card expiry MMYY (from iFields, optional w/ token)
 * @param {string} p.name          - cardholder name
 * @param {string} p.reference     - your booking reference (invoice)
 * @returns {Promise<{ok:boolean, ref?:string, mode:string, error?:string, raw?:any}>}
 */
export async function chargeDeposit({ amount, token, exp, name, reference }) {
  if (MODE === 'mock') {
    // Simulate an approved deposit so the whole flow works without live keys.
    // A token containing "decline" lets you test the failure path.
    if (token && String(token).toLowerCase().includes('decline')) {
      return { ok: false, mode: 'mock', error: 'Card declined (mock)' };
    }
    return {
      ok: true,
      mode: 'mock',
      ref: 'MOCK-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    };
  }

  // ── LIVE: Cardknox / Sola JSON gateway ──
  if (!API_KEY) {
    return { ok: false, mode: 'live', error: 'CARDKNOX_API_KEY not configured' };
  }

  const payload = {
    xKey: API_KEY,
    xVersion: '5.0.0',
    xSoftwareName: 'PrecisionCarRentals',
    xSoftwareVersion: '1.0',
    xCommand: 'cc:sale',
    xAmount: Number(amount).toFixed(2),
    xCardNum: token,        // iFields token
    xExp: exp || '',
    xName: name || '',
    xInvoice: reference || '',
    xDescription: 'Car rental deposit',
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    // xResult: 'A' approved, 'D' declined, 'E' error
    if (data.xResult === 'A') {
      return { ok: true, mode: 'live', ref: data.xRefNum, raw: data };
    }
    return {
      ok: false,
      mode: 'live',
      error: data.xError || `Payment ${data.xResult}`,
      raw: data,
    };
  } catch (err) {
    return { ok: false, mode: 'live', error: err.message };
  }
}

export const paymentMode = MODE;
