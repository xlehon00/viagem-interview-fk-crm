import 'server-only';
import { query, sqlParams } from './db';
import type { Halere } from './money';

export const PAYMENT_STATES = ['all', 'unpaid', 'partial', 'paid', 'overdue'] as const;
export type PaymentStateFilter = (typeof PAYMENT_STATES)[number];

export const PAYMENT_STATE_LABELS: Record<PaymentStateFilter, string> = {
  all: 'Vše',
  unpaid: 'Neuhrazené',
  partial: 'Částečně uhrazené',
  paid: 'Uhrazené',
  overdue: 'Po splatnosti',
};

export function parsePaymentState(value: string | null | undefined): PaymentStateFilter {
  return PAYMENT_STATES.find((s) => s === value) ?? 'all';
}

export type PaymentOverviewFilters = {
  today: string;
  search?: string;
  state?: PaymentStateFilter;
  seasonId?: number;
};

export type PaymentOverviewRow = {
  sponsorId: number;
  sponsorName: string;
  ico: string | null;
  invoiced: Halere;
  paid: Halere;
  outstanding: Halere;
  overdue: Halere;
  oldestDueDate: string | null;
  invoiceCount: number;
};

export type PaymentOverviewSummary = {
  invoiced: Halere;
  paid: Halere;
  outstanding: Halere;
  overdue: Halere;
  sponsorsWithDebt: number;
  unmatchedAmount: Halere;
  unmatchedCount: number;
};

export type UnmatchedPaymentRow = {
  id: number;
  bankRef: string;
  receivedAt: string;
  amount: Halere;
  variableSymbol: string | null;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  message: string | null;
};

// Spolecny CTE: faktura + jaka castka k ni uz dosla v bance.
// Pouzivany pro per-sponzor prehled i pro souhrn.
//
// kind in ('proforma', 'invoice') znaci "doklad k zaplaceni" (soucas PAYABLE_INVOICE_KINDS).
// tax_document ma amount = 0 (danovy doklad k zuctovani zalohy) -> neovlivni souhrn.
// credit_note ma zapornou amount -> snizi vyfakturovano a zaplaceno zaroven.
const INVOICE_PAYMENTS_CTE = `
  with invoice_payments as (
    select i.id, i.sponsor_id, i.kind, i.canceled, i.amount, i.due_date,
           coalesce(bp.paid, 0) as paid
    from invoices i
    left join (
      select matched_invoice_id, sum(amount) as paid
      from bank_payments
      where matched_invoice_id is not null
      group by matched_invoice_id
    ) bp on bp.matched_invoice_id = i.id
  )
`;

export async function listPaymentOverview(filters: PaymentOverviewFilters): Promise<PaymentOverviewRow[]> {
  const params = sqlParams();
  const today = params.add(filters.today);

  const where: string[] = ['s.deleted_at is null'];
  if (filters.search) {
    const digits = filters.search.replace(/\D/g, '');
    const like = params.add(`%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const icoClause = digits.length >= 3 ? ` or s.ico like ${params.add(`%${digits}%`)}` : '';
    where.push(`(s.name ilike ${like}${icoClause})`);
  }

  const having: string[] = [];
  switch (filters.state) {
    case 'unpaid':
      having.push('coalesce(sum(ip.amount) filter (where not ip.canceled), 0) > 0');
      having.push('coalesce(sum(ip.paid) filter (where not ip.canceled), 0) = 0');
      break;
    case 'partial':
      having.push('coalesce(sum(ip.paid) filter (where not ip.canceled), 0) > 0');
      having.push(
        'coalesce(sum(ip.paid) filter (where not ip.canceled), 0) ' +
          '< coalesce(sum(ip.amount) filter (where not ip.canceled), 0)',
      );
      break;
    case 'paid':
      having.push('coalesce(sum(ip.amount) filter (where not ip.canceled), 0) > 0');
      having.push(
        'coalesce(sum(ip.paid) filter (where not ip.canceled), 0) ' +
          '>= coalesce(sum(ip.amount) filter (where not ip.canceled), 0)',
      );
      break;
    case 'overdue':
      having.push(
        `coalesce(sum(ip.amount - ip.paid) filter (
          where not ip.canceled and ip.due_date < ${today}::date
            and ip.kind in ('proforma', 'invoice') and ip.amount > ip.paid
        ), 0) > 0`,
      );
      break;
    // 'all' / default -> ukaz jen sponzory se zaznamy (invoiced != 0 nebo paid != 0)
    default:
      having.push(
        'coalesce(sum(ip.amount) filter (where not ip.canceled), 0) != 0 ' +
          'or coalesce(sum(ip.paid) filter (where not ip.canceled), 0) != 0',
      );
  }

  const sql = `
    ${INVOICE_PAYMENTS_CTE}
    select s.id as "sponsorId", s.name as "sponsorName", s.ico,
           coalesce(sum(ip.amount) filter (where not ip.canceled), 0)::int8 as invoiced,
           coalesce(sum(ip.paid) filter (where not ip.canceled), 0)::int8 as paid,
           coalesce(sum(ip.amount - ip.paid) filter (where not ip.canceled), 0)::int8 as outstanding,
           coalesce(sum(ip.amount - ip.paid) filter (
             where not ip.canceled and ip.due_date < ${today}::date
               and ip.kind in ('proforma', 'invoice') and ip.amount > ip.paid
           ), 0)::int8 as overdue,
           to_char(min(ip.due_date) filter (
             where not ip.canceled and ip.kind in ('proforma', 'invoice')
               and ip.amount > ip.paid and ip.amount > 0
           ), 'YYYY-MM-DD') as "oldestDueDate",
           count(*) filter (
             where not ip.canceled and ip.amount > ip.paid
               and ip.kind in ('proforma', 'invoice')
           )::int as "invoiceCount"
    from sponsors s
    left join invoice_payments ip on ip.sponsor_id = s.id
    where ${where.join(' and ')}
    group by s.id, s.name, s.ico
    having ${having.join(' and ')}
    order by overdue desc, outstanding desc, s.name
    limit 500
  `;

  return query<PaymentOverviewRow>(sql, params.values);
}

export async function getPaymentOverviewSummary(today: string): Promise<PaymentOverviewSummary> {
  const [totals] = await query<{
    invoiced: Halere;
    paid: Halere;
    outstanding: Halere;
    overdue: Halere;
    sponsorsWithDebt: number;
  }>(
    `${INVOICE_PAYMENTS_CTE}
     select coalesce(sum(ip.amount) filter (where not ip.canceled), 0)::int8 as invoiced,
            coalesce(sum(ip.paid) filter (where not ip.canceled), 0)::int8 as paid,
            coalesce(sum(ip.amount - ip.paid) filter (where not ip.canceled), 0)::int8 as outstanding,
            coalesce(sum(ip.amount - ip.paid) filter (
              where not ip.canceled and ip.due_date < $1::date
                and ip.kind in ('proforma', 'invoice') and ip.amount > ip.paid
            ), 0)::int8 as overdue,
            count(distinct ip.sponsor_id) filter (
              where not ip.canceled and ip.amount - ip.paid > 0 and ip.kind in ('proforma', 'invoice')
            )::int as "sponsorsWithDebt"
     from invoice_payments ip`,
    [today],
  );

  const [unmatched] = await query<{ amount: Halere; count: number }>(
    `select coalesce(sum(amount), 0)::int8 as amount, count(*)::int as count
     from bank_payments
     where matched_invoice_id is null and amount > 0`,
  );

  return {
    invoiced: totals.invoiced,
    paid: totals.paid,
    outstanding: totals.outstanding,
    overdue: totals.overdue,
    sponsorsWithDebt: totals.sponsorsWithDebt,
    unmatchedAmount: unmatched.amount,
    unmatchedCount: unmatched.count,
  };
}

export async function listUnmatchedPayments(limit = 50): Promise<UnmatchedPaymentRow[]> {
  return query<UnmatchedPaymentRow>(
    `select id, bank_ref as "bankRef", to_char(received_at, 'YYYY-MM-DD') as "receivedAt",
            amount::int8 as amount, variable_symbol as "variableSymbol",
            counterparty_name as "counterpartyName", counterparty_account as "counterpartyAccount",
            message
     from bank_payments
     where matched_invoice_id is null and amount > 0
     order by received_at desc, id desc
     limit $1`,
    [limit],
  );
}
