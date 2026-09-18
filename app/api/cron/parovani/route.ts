import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/auth';
import { query, transaction } from '@/lib/db';
import { findMatchingInvoice, type OpenInvoice } from '@/lib/matching';
import { PAYABLE_INVOICE_KINDS, formatCzk, type Halere } from '@/lib/money';
import { insertHistory } from '@/lib/sponsors';

export const dynamic = 'force-dynamic';

type UnmatchedPayment = { id: number; amount: Halere; variableSymbol: string | null };
type OpenInvoiceRow = OpenInvoice & { sponsorId: number; number: string };

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [payments, invoices] = await Promise.all([
    query<UnmatchedPayment>(
      `select id, amount, variable_symbol as "variableSymbol"
       from bank_payments
       where matched_invoice_id is null and amount > 0
       order by received_at, id`,
    ),
    query<OpenInvoiceRow>(
      `select i.id, i.sponsor_id as "sponsorId", i.number, i.variable_symbol as "variableSymbol", i.amount
       from invoices i
       where i.kind = any($1)
         and not exists (select 1 from bank_payments bp where bp.matched_invoice_id = i.id)`,
      [PAYABLE_INVOICE_KINDS],
    ),
  ]);

  const open = [...invoices];
  let matched = 0;
  let unmatched = 0;

  for (const payment of payments) {
    const invoice = findMatchingInvoice(payment, open);
    if (!invoice) {
      unmatched += 1;
      continue;
    }

    const updated = await transaction(async (client) => {
      const { rowCount } = await client.query(
        'update bank_payments set matched_invoice_id = $1 where id = $2 and matched_invoice_id is null',
        [invoice.id, payment.id],
      );
      if (rowCount === 0) return false;
      await insertHistory(client, {
        sponsorId: invoice.sponsorId,
        userId: null,
        field: 'payment',
        newValue: `${formatCzk(payment.amount)} k dokladu ${invoice.number}`,
      });
      return true;
    });

    if (updated) {
      open.splice(open.indexOf(invoice), 1);
      matched += 1;
    }
  }

  return NextResponse.json({ matched, unmatched });
}
