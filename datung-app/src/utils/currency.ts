/**
 * Currency utilities — all amounts stored as centavos (integers).
 * Display format: ₱X,XXX.XX
 */

/** Formats centavos to "₱X,XXX.XX" */
export function formatCentavos(centavos: number): string {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Converts pesos to centavos (integer) */
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Converts centavos to pesos (float — use only for display) */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

/** Calculates prorated 6%/month interest in centavos (rounded up) */
export function calculateInterest(amountCentavos: number, days: number): number {
  return Math.ceil((amountCentavos * 0.06 * days) / 30);
}

/** Store commission: 1% of transaction amount */
export function calculateCommission(amountCentavos: number): number {
  return Math.ceil(amountCentavos * 0.01);
}
