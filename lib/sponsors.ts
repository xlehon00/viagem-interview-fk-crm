import 'server-only';
import type { PoolClient } from 'pg';
import type { BenefitCategory } from './catalogs';
import { query, sqlParams } from './db';
import type { Halere, InvoiceKind } from './money';
import { statusKeysForSection, type SponsorListSection } from './sections';
import type { DueFilter, Priority, SponsorCardValues, StatusTransition } from './sponsorCard';

export const SPONSOR_LIST_LIMIT = 200;

export type StatusRow = { id: number; key: string; name: string; color: string; position: number };

export async function listStatuses(): Promise<StatusRow[]> {
  return query<StatusRow>('select id, key, name, color, position from sponsor_statuses order by position');
}

export async function listStatusTransitions(): Promise<StatusTransition[]> {
  return query<StatusTransition>(
    `select f.key as "fromKey", t.key as "toKey"
     from sponsor_status_transitions st
     join sponsor_statuses f on f.id = st.from_status_id
     join sponsor_statuses t on t.id = st.to_status_id`,
  );
}

export type SponsorFilters = {
  section: SponsorListSection;
  today: string;
  search?: string;
  statusKey?: string;
  priority?: Priority;
  assignee?: number | 'none';
  due?: DueFilter;
};

export type SponsorListRow = {
  id: number;
  name: string;
  ico: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  statusName: string;
  statusColor: string;
  priority: Priority;
  dueDate: string | null;
  assigneeName: string | null;
  createdByName: string;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listSponsors(filters: SponsorFilters): Promise<SponsorListRow[]> {
  const params = sqlParams();
  const where = ['s.deleted_at is null'];

  const sectionKeys = statusKeysForSection(filters.section);
  if (sectionKeys) where.push(`st.key = any(${params.add(sectionKeys)})`);
  if (filters.statusKey) where.push(`st.key = ${params.add(filters.statusKey)}`);
  if (filters.priority) where.push(`s.priority = ${params.add(filters.priority)}`);
  if (filters.assignee === 'none') where.push('s.assignee_id is null');
  else if (filters.assignee) where.push(`s.assignee_id = ${params.add(filters.assignee)}`);

  switch (filters.due) {
    case 'overdue':
      where.push(`s.due_date < ${params.add(filters.today)}::date`);
      break;
    case 'today':
      where.push(`s.due_date = ${params.add(filters.today)}::date`);
      break;
    case 'week': {
      const today = params.add(filters.today);
      where.push(`s.due_date between ${today}::date and ${today}::date + 7`);
      break;
    }
    case 'none':
      where.push('s.due_date is null');
      break;
  }

  if (filters.search) {
    const text = params.add(`%${escapeLike(filters.search)}%`);
    const digits = filters.search.replace(/\D/g, '');
    const phone =
      digits.length >= 3
        ? ` or regexp_replace(s.contact_phone, '\\D', '', 'g') like ${params.add(`%${digits}%`)}`
        : '';
    where.push(`(s.name ilike ${text} or s.contact_email ilike ${text}${phone})`);
  }

  return query<SponsorListRow>(
    `select s.id, s.name, s.ico, s.contact_phone as "contactPhone", s.contact_email as "contactEmail",
            st.name as "statusName", st.color as "statusColor", s.priority,
            to_char(s.due_date, 'YYYY-MM-DD') as "dueDate", a.name as "assigneeName", c.name as "createdByName"
     from sponsors s
     join sponsor_statuses st on st.id = s.status_id
     join users c on c.id = s.created_by
     left join users a on a.id = s.assignee_id
     where ${where.join(' and ')}
     order by s.priority desc, s.due_date nulls last, s.name
     limit ${SPONSOR_LIST_LIMIT}`,
    params.values,
  );
}

const CARD_COLUMNS = `s.name, s.ico, s.contact_name as "contactName", s.contact_phone as "contactPhone",
  s.contact_email as "contactEmail", s.status_id as "statusId", s.priority,
  to_char(s.due_date, 'YYYY-MM-DD') as "dueDate", s.assignee_id as "assigneeId", s.note`;

export type SponsorDetail = SponsorCardValues & {
  id: number;
  statusKey: string;
  createdByName: string;
  createdAt: Date;
};

export async function getSponsor(id: number): Promise<SponsorDetail | null> {
  const [row] = await query<SponsorDetail>(
    `select s.id, ${CARD_COLUMNS}, st.key as "statusKey", c.name as "createdByName", s.created_at as "createdAt"
     from sponsors s
     join sponsor_statuses st on st.id = s.status_id
     join users c on c.id = s.created_by
     where s.id = $1 and s.deleted_at is null`,
    [id],
  );
  return row ?? null;
}

export async function lockSponsorCard(client: PoolClient, id: number): Promise<SponsorCardValues | null> {
  const { rows } = await client.query<SponsorCardValues>(
    `select ${CARD_COLUMNS} from sponsors s where s.id = $1 and s.deleted_at is null for update`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertSponsor(client: PoolClient, values: SponsorCardValues, createdBy: number): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `insert into sponsors (name, ico, contact_name, contact_phone, contact_email, status_id, priority, due_date,
                           assignee_id, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [
      values.name,
      values.ico,
      values.contactName,
      values.contactPhone,
      values.contactEmail,
      values.statusId,
      values.priority,
      values.dueDate,
      values.assigneeId,
      values.note,
      createdBy,
    ],
  );
  return rows[0].id;
}

export async function updateSponsor(client: PoolClient, id: number, values: SponsorCardValues): Promise<void> {
  await client.query(
    `update sponsors
     set name = $2, ico = $3, contact_name = $4, contact_phone = $5, contact_email = $6, status_id = $7,
         priority = $8, due_date = $9, assignee_id = $10, note = $11, updated_at = now()
     where id = $1`,
    [
      id,
      values.name,
      values.ico,
      values.contactName,
      values.contactPhone,
      values.contactEmail,
      values.statusId,
      values.priority,
      values.dueDate,
      values.assigneeId,
      values.note,
    ],
  );
}

export type SponsorBenefitRow = {
  id: number;
  category: BenefitCategory;
  benefitName: string;
  seasonName: string;
  quantity: number;
  note: string | null;
};

export async function listSponsorBenefits(sponsorId: number): Promise<SponsorBenefitRow[]> {
  return query<SponsorBenefitRow>(
    `select sb.id, b.category, b.name as "benefitName", se.name as "seasonName", sb.quantity, sb.note
     from sponsor_benefits sb
     join benefits b on b.id = sb.benefit_id
     join seasons se on se.id = sb.season_id
     where sb.sponsor_id = $1
     order by se.starts_on desc, b.name`,
    [sponsorId],
  );
}

export type InstallmentRow = { id: number; contractId: number; dueDate: string; amount: Halere };

export type ContractRow = {
  id: number;
  number: string;
  title: string;
  seasonName: string;
  packageName: string | null;
  totalAmount: Halere;
  signedAt: string | null;
  inKindDescription: string | null;
  inKindValue: Halere;
  installments: InstallmentRow[];
};

export async function listContracts(sponsorId: number): Promise<ContractRow[]> {
  const [contracts, installments] = await Promise.all([
    query<Omit<ContractRow, 'installments'>>(
      `select c.id, c.number, c.title, se.name as "seasonName", p.name as "packageName",
              c.total_amount as "totalAmount", to_char(c.signed_at, 'YYYY-MM-DD') as "signedAt",
              c.in_kind_description as "inKindDescription", c.in_kind_value as "inKindValue"
       from contracts c
       join seasons se on se.id = c.season_id
       left join packages p on p.id = c.package_id
       where c.sponsor_id = $1
       order by se.starts_on desc, c.number`,
      [sponsorId],
    ),
    query<InstallmentRow>(
      `select ins.id, ins.contract_id as "contractId", to_char(ins.due_date, 'YYYY-MM-DD') as "dueDate", ins.amount
       from installments ins
       join contracts c on c.id = ins.contract_id
       where c.sponsor_id = $1
       order by ins.due_date`,
      [sponsorId],
    ),
  ]);
  return contracts.map((contract) => ({
    ...contract,
    installments: installments.filter((installment) => installment.contractId === contract.id),
  }));
}

export type InvoiceRow = {
  id: number;
  kind: InvoiceKind;
  number: string;
  variableSymbol: string;
  dueDate: string;
  amount: Halere;
  paid: Halere;
};

export async function listInvoices(sponsorId: number): Promise<InvoiceRow[]> {
  return query<InvoiceRow>(
    `select i.id, i.kind, i.number, i.variable_symbol as "variableSymbol",
            to_char(i.due_date, 'YYYY-MM-DD') as "dueDate", i.amount,
            coalesce((select sum(bp.amount) from bank_payments bp where bp.matched_invoice_id = i.id), 0)::int8 as paid
     from invoices i
     where i.sponsor_id = $1
     order by i.issued_at desc, i.id desc`,
    [sponsorId],
  );
}

export type PendingPaymentRow = {
  id: number;
  receivedAt: string;
  amount: Halere;
  variableSymbol: string | null;
  counterpartyName: string | null;
};

export async function listPendingPayments(sponsorId: number): Promise<PendingPaymentRow[]> {
  return query<PendingPaymentRow>(
    `select bp.id, to_char(bp.received_at, 'YYYY-MM-DD') as "receivedAt", bp.amount,
            bp.variable_symbol as "variableSymbol", bp.counterparty_name as "counterpartyName"
     from bank_payments bp
     where bp.matched_invoice_id is null
       and exists (
         select 1 from invoices i
         where i.sponsor_id = $1 and trim(i.variable_symbol) = trim(bp.variable_symbol)
       )
     order by bp.received_at desc`,
    [sponsorId],
  );
}

export type HistoryRow = {
  id: number;
  createdAt: Date;
  userName: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

export async function listHistory(sponsorId: number): Promise<HistoryRow[]> {
  return query<HistoryRow>(
    `select h.id, h.created_at as "createdAt", u.name as "userName", h.field,
            h.old_value as "oldValue", h.new_value as "newValue"
     from history h
     left join users u on u.id = h.user_id
     where h.sponsor_id = $1
     order by h.created_at desc, h.id desc`,
    [sponsorId],
  );
}

export type HistoryEntry = {
  sponsorId: number;
  userId: number | null;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export async function insertHistory(client: PoolClient, entry: HistoryEntry): Promise<void> {
  await client.query(
    `insert into history (sponsor_id, user_id, field, old_value, new_value)
     values ($1, $2, $3, $4, $5)`,
    [entry.sponsorId, entry.userId, entry.field, entry.oldValue ?? null, entry.newValue ?? null],
  );
}

export type StatusOverviewRow = StatusRow & { sponsors: number; overdue: number };

export async function getStatusOverview(today: string): Promise<StatusOverviewRow[]> {
  return query<StatusOverviewRow>(
    `select st.id, st.key, st.name, st.color, st.position,
            count(s.id) as sponsors,
            count(s.id) filter (where s.due_date < $1::date) as overdue
     from sponsor_statuses st
     left join sponsors s on s.status_id = st.id and s.deleted_at is null
     group by st.id
     order by st.position`,
    [today],
  );
}

export type SeasonOverviewRow = { seasonName: string; contracts: number; totalAmount: Halere };

export async function getSeasonOverview(): Promise<SeasonOverviewRow[]> {
  return query<SeasonOverviewRow>(
    `select se.name as "seasonName", count(c.id) as contracts,
            coalesce(sum(c.total_amount), 0)::int8 as "totalAmount"
     from seasons se
     left join contracts c on c.season_id = se.id
     group by se.id
     order by se.starts_on desc`,
  );
}
