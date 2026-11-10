// Tencky typovy wrapper nad lib/matching.mjs. Beh logiky zije v .mjs, aby ji
// mohl pouzit i scripts/import-fk-data.mjs (Node loader neumi .ts bez tsx).
import { findMatchingInvoice as findMatchingInvoiceJs, matchingKey as matchingKeyJs } from './matching.mjs';
import type { Halere } from './money';

export type PaymentToMatch = { amount: Halere; variableSymbol: string | null };
export type OpenInvoice = { id: number; variableSymbol: string; amount: Halere };

export const matchingKey = matchingKeyJs as (
  variableSymbol: string | null | undefined,
  amount: Halere,
) => string | null;

export const findMatchingInvoice = findMatchingInvoiceJs as <T extends OpenInvoice>(
  payment: PaymentToMatch,
  openInvoices: readonly T[],
) => T | null;
