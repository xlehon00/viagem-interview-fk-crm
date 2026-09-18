import { describe, expect, it } from 'vitest';
import { findMatchingInvoice, type OpenInvoice } from './matching';

const invoices: OpenInvoice[] = [
  { id: 1, variableSymbol: '20260001', amount: 3000000 },
  { id: 2, variableSymbol: '20260002', amount: 3000000 },
];

describe('findMatchingInvoice', () => {
  it('najde doklad se shodným VS a přesnou částkou', () => {
    expect(findMatchingInvoice({ amount: 3000000, variableSymbol: '20260002' }, invoices)).toBe(invoices[1]);
  });

  it('VS z banky ořízne o mezery', () => {
    expect(findMatchingInvoice({ amount: 3000000, variableSymbol: ' 20260001 ' }, invoices)).toBe(invoices[0]);
  });

  it('platbu s jinou částkou nebo bez VS nespáruje', () => {
    expect(findMatchingInvoice({ amount: 3630000, variableSymbol: '20260001' }, invoices)).toBeNull();
    expect(findMatchingInvoice({ amount: 3000000, variableSymbol: null }, invoices)).toBeNull();
    expect(findMatchingInvoice({ amount: 3000000, variableSymbol: '   ' }, invoices)).toBeNull();
  });
});
