import { BENEFIT_CATEGORIES, BENEFIT_CATEGORY_LABELS, listBenefits, listSeasons } from '@/lib/catalogs';
import { formatDate, todayIso } from '@/lib/dates';
import {
  INVOICE_KIND_LABELS,
  PAYABLE_INVOICE_KINDS,
  PAYMENT_STATE_LABELS,
  formatCzk,
  paymentState,
  sumHalere,
} from '@/lib/money';
import type { UserOption } from '@/lib/session';
import { dueState } from '@/lib/sponsorCard';
import { listContracts, listInvoices, listPendingPayments, listSponsorBenefits } from '@/lib/sponsors';
import { listTasks } from '@/lib/tasks';
import { completeTask } from '../ukoly/actions';
import { addSponsorBenefit, addSponsorTask } from './actions';

type Props = {
  sponsorId: number;
  listQuery: string;
  users: UserOption[];
  currentUserId: number;
};

export async function LinkedSections({ sponsorId, listQuery, users, currentUserId }: Props) {
  const [benefits, benefitOptions, seasons, contracts, invoices, pendingPayments, tasks] = await Promise.all([
    listSponsorBenefits(sponsorId),
    listBenefits({ activeOnly: true }),
    listSeasons(),
    listContracts(sponsorId),
    listInvoices(sponsorId),
    listPendingPayments(sponsorId),
    listTasks({ view: 'all', userId: currentUserId, sponsorId }),
  ]);
  const today = todayIso();

  return (
    <aside className="linked">
      <section>
        <h3>Protiplnění</h3>
        {benefits.length === 0 ? (
          <p className="empty">Zatím žádné protiplnění.</p>
        ) : (
          <table className="compact">
            <tbody>
              {benefits.map((benefit) => (
                <tr key={benefit.id}>
                  <td className="muted">{BENEFIT_CATEGORY_LABELS[benefit.category]}</td>
                  <td>{benefit.benefitName}</td>
                  <td className="num">{benefit.quantity} ×</td>
                  <td>{benefit.seasonName}</td>
                  <td className="muted">{benefit.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addSponsorBenefit} className="inline-form">
          <input type="hidden" name="sponsorId" value={sponsorId} />
          <input type="hidden" name="listQuery" value={listQuery} />
          <select name="benefitId" required defaultValue="" aria-label="Protiplnění">
            <option value="" disabled>
              Protiplnění
            </option>
            {BENEFIT_CATEGORIES.map((category) => {
              const options = benefitOptions.filter((benefit) => benefit.category === category);
              if (options.length === 0) return null;
              return (
                <optgroup key={category} label={BENEFIT_CATEGORY_LABELS[category]}>
                  {options.map((benefit) => (
                    <option key={benefit.id} value={benefit.id}>
                      {benefit.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <select name="seasonId" required defaultValue={seasons[0]?.id ?? ''} aria-label="Období">
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
          <input name="quantity" type="number" min={1} defaultValue={1} aria-label="Počet" style={{ width: '4.5rem' }} />
          <input name="note" placeholder="Poznámka" />
          <button type="submit">Přidat protiplnění</button>
        </form>
      </section>

      <section>
        <h3>Smlouvy</h3>
        {contracts.length === 0 && <p className="empty">Sponzor zatím nemá smlouvu.</p>}
        {contracts.map((contract) => {
          const scheduled = sumHalere(contract.installments.map((installment) => installment.amount));
          return (
            <div key={contract.id}>
              <p>
                <strong>{contract.title}</strong> <span className="muted">č. {contract.number}</span>
                <br />
                <span className="muted small">
                  {contract.seasonName}
                  {contract.packageName && ` · balíček ${contract.packageName}`} · {formatCzk(contract.totalAmount)} ·{' '}
                  {contract.signedAt ? `podepsáno ${formatDate(contract.signedAt)}` : 'nepodepsáno'}
                </span>
                {contract.inKindDescription && (
                  <>
                    <br />
                    <span className="small">
                      Věcné plnění: {contract.inKindDescription} ({formatCzk(contract.inKindValue)})
                    </span>
                  </>
                )}
              </p>
              {scheduled !== contract.totalAmount && (
                <p className="alert error">
                  Splátkový kalendář ({formatCzk(scheduled)}) nesedí s částkou smlouvy.
                </p>
              )}
              <table className="compact">
                <thead>
                  <tr>
                    <th>Splátka</th>
                    <th className="num">Částka</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.installments.map((installment) => (
                    <tr key={installment.id}>
                      <td>{formatDate(installment.dueDate)}</td>
                      <td className="num">{formatCzk(installment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {invoices.length > 0 && (
          <>
            <h3 style={{ marginTop: '0.75rem' }}>Doklady</h3>
            <table className="compact">
              <thead>
                <tr>
                  <th>Doklad</th>
                  <th>Splatnost</th>
                  <th className="num">Částka</th>
                  <th>Stav</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const payable = PAYABLE_INVOICE_KINDS.includes(invoice.kind);
                  const state = paymentState(invoice.amount, invoice.paid);
                  const late = payable && (state === 'unpaid' || state === 'partial') && invoice.dueDate < today;
                  return (
                    <tr key={invoice.id}>
                      <td>
                        {invoice.number}
                        <div className="muted small">
                          {INVOICE_KIND_LABELS[invoice.kind]} · VS {invoice.variableSymbol}
                        </div>
                      </td>
                      <td className={late ? 'due-overdue' : undefined}>{formatDate(invoice.dueDate)}</td>
                      <td className="num">{formatCzk(invoice.amount)}</td>
                      <td>{payable ? PAYMENT_STATE_LABELS[state] : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {pendingPayments.length > 0 && (
          <>
            <h3 style={{ marginTop: '0.75rem' }}>Platby čekající na párování</h3>
            <table className="compact">
              <tbody>
                {pendingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.receivedAt)}</td>
                    <td>VS {payment.variableSymbol ?? '–'}</td>
                    <td>{payment.counterpartyName}</td>
                    <td className="num">{formatCzk(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h3>Úkoly</h3>
        {tasks.length === 0 ? (
          <p className="empty">Žádný otevřený úkol.</p>
        ) : (
          <table className="compact">
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td className={`due-${dueState(task.dueDate, today) ?? 'none'}`}>{formatDate(task.dueDate)}</td>
                  <td>{task.assigneeNames}</td>
                  <td className="num">{task.progress} %</td>
                  <td className="num">
                    <form action={completeTask.bind(null, task.id)}>
                      <button type="submit" className="small">
                        Hotovo
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addSponsorTask} className="inline-form">
          <input type="hidden" name="sponsorId" value={sponsorId} />
          <input type="hidden" name="listQuery" value={listQuery} />
          <input name="title" placeholder="Nový úkol" required />
          <select name="assigneeIds" multiple size={2} defaultValue={[String(currentUserId)]} aria-label="Řešitelé">
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <input name="dueDate" type="date" aria-label="Deadline" />
          <button type="submit">Přidat úkol</button>
        </form>
      </section>
    </aside>
  );
}
