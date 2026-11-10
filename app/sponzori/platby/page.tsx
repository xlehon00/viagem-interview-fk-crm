import Link from 'next/link';
import { todayIso } from '@/lib/dates';
import { formatCzk } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import {
  getPaymentOverviewSummary,
  listPaymentOverview,
  listUnmatchedPayments,
  parsePaymentState,
  PAYMENT_STATES,
  PAYMENT_STATE_LABELS,
  type PaymentOverviewRow,
  type PaymentOverviewSummary,
  type UnmatchedPaymentRow,
} from '@/lib/payments';

type SearchParams = {
  q?: string;
  state?: string;
};

export const dynamic = 'force-dynamic';

export default async function PaymentsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const today = todayIso();
  const state = parsePaymentState(params.state);

  const [rows, summary, unmatched] = await Promise.all([
    listPaymentOverview({ today, search: params.q?.trim() || undefined, state }),
    getPaymentOverviewSummary(today),
    listUnmatchedPayments(20),
  ]);

  return (
    <>
      <div className="page-header">
        <h1>Sponzoři: Platby</h1>
      </div>

      <StatRow summary={summary} />

      <form method="get" className="filters">
        <input type="search" name="q" defaultValue={params.q} placeholder="Název nebo IČO sponzora" />
        <select name="state" defaultValue={state} aria-label="Stav platby">
          {PAYMENT_STATES.map((key) => (
            <option key={key} value={key}>
              {PAYMENT_STATE_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="submit">Filtrovat</button>
        <Link href="/sponzori/platby" className="button secondary">
          Zrušit filtry
        </Link>
      </form>

      {rows.length === 0 ? (
        <p className="empty">Žádný sponzor neodpovídá filtru.</p>
      ) : (
        <PaymentTable rows={rows} today={today} />
      )}

      <UnmatchedSection unmatched={unmatched} totalCount={summary.unmatchedCount} />
    </>
  );
}

function StatRow({ summary }: { summary: PaymentOverviewSummary }) {
  return (
    <div className="stat-row">
      <Stat label="Vyfakturováno" value={formatCzk(summary.invoiced)} />
      <Stat label="Zaplaceno" value={formatCzk(summary.paid)} />
      <Stat
        label="Zbývá"
        value={formatCzk(summary.outstanding)}
        note={`${summary.sponsorsWithDebt} sponzorů s nedoplatkem`}
      />
      <Stat
        label="Po splatnosti"
        value={formatCzk(summary.overdue)}
        highlight={summary.overdue > 0}
      />
      <Stat
        label="Nespárované platby"
        value={formatCzk(summary.unmatchedAmount)}
        note={`${summary.unmatchedCount} položek`}
        highlight={summary.unmatchedCount > 0}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'stat highlight' : 'stat'}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

function PaymentTable({ rows, today }: { rows: PaymentOverviewRow[]; today: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Sponzor</th>
          <th>IČO</th>
          <th className="num">Vyfakturováno</th>
          <th className="num">Zaplaceno</th>
          <th className="num">Zbývá</th>
          <th className="num">Po splatnosti</th>
          <th>Nejstarší splatnost</th>
          <th>Stav</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.sponsorId}>
            <td>
              <Link href={`/sponzori?section=manage&detail=${row.sponsorId}`} className="row-link">
                {row.sponsorName}
              </Link>
              <div className="muted small">
                {row.invoiceCount} {row.invoiceCount === 1 ? 'otevřený doklad' : 'otevřených dokladů'}
              </div>
            </td>
            <td>{row.ico ?? <span className="muted">—</span>}</td>
            <td className="num">{formatCzk(row.invoiced)}</td>
            <td className="num pay-paid">{formatCzk(row.paid)}</td>
            <td className="num">{formatCzk(row.outstanding)}</td>
            <td className={row.overdue > 0 ? 'num pay-overdue' : 'num'}>
              {row.overdue > 0 ? formatCzk(row.overdue) : <span className="muted">—</span>}
            </td>
            <td className={row.oldestDueDate && row.oldestDueDate < today ? 'pay-overdue' : ''}>
              {formatDate(row.oldestDueDate)}
            </td>
            <td>
              <PaymentStateBadge row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentStateBadge({ row }: { row: PaymentOverviewRow }) {
  if (row.overdue > 0) return <span className="badge pay-overdue">Po splatnosti</span>;
  if (row.invoiced <= 0 && row.paid === 0) return <span className="badge muted">Bez dokladů</span>;
  if (row.outstanding <= 0 && row.invoiced > 0) return <span className="badge pay-paid">Uhrazeno</span>;
  if (row.paid > 0 && row.outstanding > 0) return <span className="badge">Částečně</span>;
  return <span className="badge">Neuhrazeno</span>;
}

function UnmatchedSection({
  unmatched,
  totalCount,
}: {
  unmatched: UnmatchedPaymentRow[];
  totalCount: number;
}) {
  if (totalCount === 0) {
    return (
      <section style={{ marginTop: '2rem' }}>
        <h2>Nespárované platby</h2>
        <p className="muted">Všechny příchozí platby jsou spárované s dokladem.</p>
      </section>
    );
  }
  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>
        Nespárované platby{' '}
        <span className="muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
          (zobrazeno {unmatched.length} z {totalCount})
        </span>
      </h2>
      <p className="muted">
        Platby, které přišly na účet, ale VS nebo částka neodpovídá žádnému otevřenému dokladu. Účetní je
        musí přiřadit ručně po dohodě se sponzorem.
      </p>
      <table>
        <thead>
          <tr>
            <th>Přijato</th>
            <th>Odesílatel</th>
            <th>VS</th>
            <th className="num">Částka</th>
            <th>Zpráva</th>
            <th>Bank. ref.</th>
          </tr>
        </thead>
        <tbody>
          {unmatched.map((p) => (
            <tr key={p.id}>
              <td>{p.receivedAt}</td>
              <td>
                {p.counterpartyName ?? <span className="muted">—</span>}
                {p.counterpartyAccount && <div className="muted small">{p.counterpartyAccount}</div>}
              </td>
              <td>{p.variableSymbol ?? <span className="muted">—</span>}</td>
              <td className="num">{formatCzk(p.amount)}</td>
              <td>{p.message ?? <span className="muted">—</span>}</td>
              <td className="muted small">{p.bankRef}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
