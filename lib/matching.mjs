// Jediny zdroj pravdy pro parovani bankovni platby s dokladem.
// Pouzivaji: app/api/cron/parovani (pres lib/matching.ts re-export) a
//           scripts/import-fk-data.mjs (primo).
//
// Pravidla: shoda VS (po trim) a presna shoda castky v halerich.
// Pokud se pravidla rozsiruji (tolerance, IC protiuctu, castecne platby),
// meni se zde — obe cesty automaticky dostanou novou verzi.

/**
 * @param {string | null | undefined} variableSymbol
 * @param {number} amount — castka v halerich (bigint-safe int)
 * @returns {string | null}
 */
export function matchingKey(variableSymbol, amount) {
  if (variableSymbol == null) return null;
  const vs = String(variableSymbol).trim();
  if (!vs) return null;
  return `${vs}:${amount}`;
}

/**
 * Najde doklad, ktery presne odpovida prichozi platbe.
 * @template {{ id: number, variableSymbol: string, amount: number }} T
 * @param {{ amount: number, variableSymbol: string | null }} payment
 * @param {readonly T[]} openInvoices
 * @returns {T | null}
 */
export function findMatchingInvoice(payment, openInvoices) {
  const key = matchingKey(payment.variableSymbol, payment.amount);
  if (!key) return null;
  for (const invoice of openInvoices) {
    if (matchingKey(invoice.variableSymbol, invoice.amount) === key) return invoice;
  }
  return null;
}
