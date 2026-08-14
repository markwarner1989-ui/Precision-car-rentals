// ─────────────────────────────────────────────────────────────
// Pricing + availability rules
// ─────────────────────────────────────────────────────────────

// Insurance daily rates by coverage type.
export const INSURANCE = {
  liability: { label: 'Liability', daily: 19, photosRequired: 1 },
  full:      { label: 'Full Coverage', daily: 35, photosRequired: 2 },
};

// Whole days between pickup and return (minimum 1).
export function rentalDays(pickupAt, returnAt) {
  const a = new Date(pickupAt);
  const b = new Date(returnAt);
  const ms = b - a;
  if (isNaN(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Build a full quote for a category + dates + coverage.
 * Deposit is the category's FIXED deposit — never computed from days.
 */
export function quote(category, pickupAt, returnAt, coverageType) {
  const days = rentalDays(pickupAt, returnAt);
  const cov = INSURANCE[coverageType];
  if (!cov) throw new Error('Invalid coverage type');

  const rentalSubtotal = +(category.daily_rate * days).toFixed(2);
  const insuranceSubtotal = +(cov.daily * days).toFixed(2);
  const deposit = +category.deposit.toFixed(2);          // FIXED
  const dueAtPickup = +(rentalSubtotal + insuranceSubtotal).toFixed(2);

  return {
    days,
    dailyRate: category.daily_rate,
    coverageType,
    coverageLabel: cov.label,
    insuranceDaily: cov.daily,
    photosRequired: cov.photosRequired,
    rentalSubtotal,
    insuranceSubtotal,
    deposit,            // due now
    dueAtPickup,        // due at pickup
    total: +(deposit + dueAtPickup).toFixed(2),
  };
}

// Does [s1,e1] overlap [s2,e2]? (date strings)
function overlaps(s1, e1, s2, e2) {
  return new Date(s1) <= new Date(e2) && new Date(s2) <= new Date(e1);
}

// A category is available for the requested dates if no admin block overlaps.
export function isCategoryAvailable(blocks, pickupAt, returnAt) {
  const p = pickupAt.slice(0, 10);
  const r = returnAt.slice(0, 10);
  return !blocks.some((b) => overlaps(p, r, b.start_date, b.end_date));
}
