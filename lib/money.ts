export type Halere = number;

export const INVOICE_KINDS = ['proforma', 'invoice', 'tax_document', 'credit_note'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  proforma: 'Zálohová faktura',
  invoice: 'Faktura',
  tax_document: 'Daňový doklad k platbě',
  credit_note: 'Dobropis',
};

export const PAYABLE_INVOICE_KINDS: readonly InvoiceKind[] = ['proforma', 'invoice'];

const czk = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' });

export function formatCzk(amount: Halere): string {
  return czk.format(amount / 100);
}

export function parseCzk(input: string): Halere | null {
  const normalized = input.replace(/\s|kč/gi, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function sumHalere(amounts: readonly Halere[]): Halere {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export type PaymentState = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: 'Neuhrazeno',
  partial: 'Částečně uhrazeno',
  paid: 'Uhrazeno',
  overpaid: 'Přeplaceno',
};

export function paymentState(amount: Halere, paid: Halere): PaymentState {
  if (paid <= 0) return 'unpaid';
  if (paid < amount) return 'partial';
  if (paid === amount) return 'paid';
  return 'overpaid';
}
