import Link from 'next/link';
import { formatDateTime, todayIso } from '@/lib/dates';
import { parseId } from '@/lib/forms';
import { sponsorListUrl } from '@/lib/sections';
import { requireUser, type UserOption } from '@/lib/session';
import {
  DEFAULT_PRIORITY,
  HISTORY_FIELD_LABELS,
  INITIAL_STATUS_KEY,
  PRIORITIES,
  PRIORITY_LABELS,
  dueState,
  statusOptions,
  type SponsorCardValues,
} from '@/lib/sponsorCard';
import {
  getSponsor,
  listHistory,
  listStatusTransitions,
  type SponsorDetail,
  type StatusRow,
} from '@/lib/sponsors';
import { createSponsor, deleteSponsor, saveSponsor } from './actions';
import { LinkedSections } from './LinkedSections';

const SAVED_MESSAGES: Record<string, string> = {
  created: 'Sponzor byl přidán.',
  card: 'Sponzor byl uložen.',
  benefit: 'Protiplnění bylo přidáno.',
  task: 'Úkol byl přidán.',
};

type Props = {
  detail: string;
  statuses: StatusRow[];
  users: UserOption[];
  listQuery: string;
  error?: string;
  saved?: string;
  confirmDelete: boolean;
};

export async function SponsorModal({ detail, statuses, users, listQuery, error, saved, confirmDelete }: Props) {
  const closeHref = sponsorListUrl(listQuery);
  const isNew = detail === 'new';
  const sponsorId = isNew ? null : parseId(detail);
  const sponsor = sponsorId === null ? null : await getSponsor(sponsorId);

  if (!isNew && !sponsor) {
    return (
      <ModalFrame title="Sponzor nenalezen" closeHref={closeHref}>
        <p className="alert error">Sponzor neexistuje nebo byl smazán.</p>
        <footer className="modal-footer">
          <span className="spacer" />
          <Link href={closeHref} className="button secondary">
            Zavřít
          </Link>
        </footer>
      </ModalFrame>
    );
  }

  const [user, transitions] = await Promise.all([requireUser(), listStatusTransitions()]);
  const initialStatus = statuses.find((status) => status.key === INITIAL_STATUS_KEY) ?? statuses[0];
  const allowedStatuses = sponsor ? statusOptions(statuses, transitions, sponsor.statusKey) : [initialStatus];
  const values: SponsorCardValues = sponsor ?? {
    name: '',
    ico: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    statusId: initialStatus.id,
    priority: DEFAULT_PRIORITY,
    dueDate: null,
    assigneeId: user.id,
    note: null,
  };

  return (
    <ModalFrame title={sponsor ? sponsor.name : 'Přidat sponzora'} closeHref={closeHref}>
      {error && <p className="alert error">{error}</p>}
      {saved && SAVED_MESSAGES[saved] && <p className="alert success">{SAVED_MESSAGES[saved]}</p>}

      <div className="modal-body">
        <div className="modal-left">
          <SponsorForm
            sponsor={sponsor}
            values={values}
            statuses={allowedStatuses}
            users={users}
            listQuery={listQuery}
          />
          {sponsor && <SponsorHistory sponsorId={sponsor.id} />}
        </div>
        {sponsor ? (
          <LinkedSections sponsorId={sponsor.id} listQuery={listQuery} users={users} currentUserId={user.id} />
        ) : (
          <p className="muted">Protiplnění, smlouvy a úkoly půjde přidat po uložení sponzora.</p>
        )}
      </div>

      <footer className="modal-footer">
        {sponsor && !confirmDelete && (
          <Link
            href={sponsorListUrl(listQuery, { detail: String(sponsor.id), confirmDelete: '1' })}
            className="link-danger"
          >
            Smazat sponzora
          </Link>
        )}
        {sponsor && confirmDelete && (
          <form action={deleteSponsor} className="inline-form">
            <input type="hidden" name="sponsorId" value={sponsor.id} />
            <input type="hidden" name="listQuery" value={listQuery} />
            <span>Opravdu si přejete smazat tohoto sponzora?</span>
            <button type="submit" className="danger">
              Smazat sponzora
            </button>
            <Link href={sponsorListUrl(listQuery, { detail: String(sponsor.id) })} className="button secondary">
              Ponechat
            </Link>
          </form>
        )}
        <span className="spacer" />
        <Link href={closeHref} className="button secondary">
          Zavřít
        </Link>
        <button type="submit" form="sponsor-form">
          {sponsor ? 'Uložit sponzora' : 'Přidat sponzora'}
        </button>
      </footer>
    </ModalFrame>
  );
}

function ModalFrame({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sponsor-modal-title">
        <header className="modal-header">
          <h2 id="sponsor-modal-title">{title}</h2>
          <Link href={closeHref} className="modal-close" aria-label="Zavřít">
            ×
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}

type SponsorFormProps = {
  sponsor: SponsorDetail | null;
  values: SponsorCardValues;
  statuses: StatusRow[];
  users: UserOption[];
  listQuery: string;
};

function SponsorForm({ sponsor, values, statuses, users, listQuery }: SponsorFormProps) {
  const due = dueState(values.dueDate, todayIso());

  return (
    <form id="sponsor-form" action={sponsor ? saveSponsor : createSponsor} className="card-form">
      {sponsor && <input type="hidden" name="sponsorId" value={sponsor.id} />}
      <input type="hidden" name="listQuery" value={listQuery} />

      <label>
        Název
        <input name="name" required defaultValue={values.name} />
      </label>
      <label>
        Stav jednání
        <select name="statusId" defaultValue={values.statusId}>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label>
          Priorita
          <select name="priority" defaultValue={values.priority}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className={due ? `due-${due}` : undefined}>
          Due date
          <input type="date" name="dueDate" defaultValue={values.dueDate ?? ''} />
        </label>
      </div>
      <div className="field-row">
        <label>
          Řešitel
          <select name="assigneeId" defaultValue={values.assigneeId ?? ''}>
            <option value="">Bez řešitele</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          IČO
          <input name="ico" inputMode="numeric" pattern="\d{8}" defaultValue={values.ico ?? ''} />
        </label>
      </div>
      {sponsor && (
        <p className="muted small">
          Zadavatel: {sponsor.createdByName}, {formatDateTime(sponsor.createdAt)}
        </p>
      )}
      <fieldset>
        <legend>Kontakt</legend>
        <label>
          Kontaktní osoba
          <input name="contactName" defaultValue={values.contactName ?? ''} />
        </label>
        <div className="field-row">
          <label>
            Telefon
            <input name="contactPhone" type="tel" defaultValue={values.contactPhone ?? ''} />
          </label>
          <label>
            E-mail
            <input name="contactEmail" type="email" defaultValue={values.contactEmail ?? ''} />
          </label>
        </div>
      </fieldset>
      <label>
        Poznámka
        <textarea name="note" rows={3} defaultValue={values.note ?? ''} />
      </label>
    </form>
  );
}

async function SponsorHistory({ sponsorId }: { sponsorId: number }) {
  const history = await listHistory(sponsorId);
  return (
    <section className="modal-history">
      <h3>Historie</h3>
      {history.length === 0 ? (
        <p className="empty">Zatím žádné změny.</p>
      ) : (
        <table className="compact">
          <thead>
            <tr>
              <th>Kdy</th>
              <th>Kdo</th>
              <th>Pole</th>
              <th>Z</th>
              <th>Na</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>{entry.userName ?? <span className="muted">automat</span>}</td>
                <td>{HISTORY_FIELD_LABELS[entry.field] ?? entry.field}</td>
                <td>{entry.oldValue ?? '–'}</td>
                <td>{entry.newValue ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
