import type { Halere } from './money';

export type PaymentToMatch = { amount: Halere; variableSymbol: string | null };
export type OpenInvoice = { id: number; variableSymbol: string; amount: Halere };

export function findMatchingInvoice<T extends OpenInvoice>(
  payment: PaymentToMatch,
  openInvoices: readonly T[],
): T | null {
  const vs = payment.variableSymbol?.trim();
  if (!vs) return null;
  return openInvoices.find((invoice) => invoice.variableSymbol.trim() === vs && invoice.amount === payment.amount) ?? null;
}
