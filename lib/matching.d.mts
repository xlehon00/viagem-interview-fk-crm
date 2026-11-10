export function matchingKey(
  variableSymbol: string | null | undefined,
  amount: number,
): string | null;

export function findMatchingInvoice<T extends { id: number; variableSymbol: string; amount: number }>(
  payment: { amount: number; variableSymbol: string | null },
  openInvoices: readonly T[],
): T | null;
