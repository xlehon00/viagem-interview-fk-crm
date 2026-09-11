import Link from 'next/link';
import { formatDate, todayIso } from '@/lib/dates';
import { parseId } from '@/lib/forms';
import {
  SPONSOR_SECTION_LABELS,
  parseSponsorSection,
  sponsorListQuery,
  sponsorListUrl,
  statusKeysForSection,
} from '@/lib/sections';
import { listActiveUsers } from '@/lib/session';
import {
  DUE_FILTERS,
  DUE_FILTER_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  dueState,
  parseDueFilter,
  parsePriority,
} from '@/lib/sponsorCard';
import { SPONSOR_LIST_LIMIT, listSponsors, listStatuses } from '@/lib/sponsors';
import { SponsorModal } from './SponsorModal';

type SearchParams = {
  section?: string;
  q?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  due?: string;
  detail?: string;
  error?: string;
  saved?: string;
  deleted?: string;
  confirmDelete?: string;
};

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const section = parseSponsorSection(params.section);
  const today = todayIso();

  const [statuses, users, sponsors] = await Promise.all([
    listStatuses(),
    listActiveUsers(),
    listSponsors({
      section,
      today,
      search: params.q?.trim() || undefined,
      statusKey: params.status || undefined,
      priority: parsePriority(params.priority) ?? undefined,
      assignee: params.assignee === 'none' ? 'none' : (parseId(params.assignee) ?? undefined),
      due: parseDueFilter(params.due),
    }),
  ]);

  const sectionKeys = statusKeysForSection(section);
  const sectionStatuses = sectionKeys ? statuses.filter((status) => sectionKeys.includes(status.key)) : statuses;
  const listQuery = sponsorListQuery(params);

  return (
    <>
      <div className="page-header">
        <h1>Sponzoři · {SPONSOR_SECTION_LABELS[section]}</h1>
        {section === 'negotiating' && (
          <Link href={sponsorListUrl(params, { detail: 'new' })} className="button">
            Přidat sponzora
          </Link>
        )}
      </div>

      {params.deleted && <p className="alert success">Sponzor byl smazán.</p>}

      <form method="get" className="filters">
        <input type="hidden" name="section" value={section} />
        <input type="search" name="q" defaultValue={params.q} placeholder="Název, telefon, e-mail" />
        <select name="priority" defaultValue={params.priority ?? ''} aria-label="Priorita">
          <option value="">Priorita</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} aria-label="Stav">
          <option value="">Stav</option>
          {sectionStatuses.map((status) => (
            <option key={status.key} value={status.key}>
              {status.name}
            </option>
          ))}
        </select>
        <select name="assignee" defaultValue={params.assignee ?? ''} aria-label="Řešitel">
          <option value="">Řešitel</option>
          <option value="none">Bez řešitele</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select name="due" defaultValue={params.due ?? ''} aria-label="Due date">
          <option value="">Due date</option>
          {DUE_FILTERS.map((filter) => (
            <option key={filter} value={filter}>
              {DUE_FILTER_LABELS[filter]}
            </option>
          ))}
        </select>
        <button type="submit">Filtrovat</button>
        <Link href={`/sponzori?section=${section}`} className="button secondary">
          Zrušit filtry
        </Link>
      </form>

      {sponsors.length === 0 ? (
        <p className="empty">Žádný sponzor neodpovídá filtru.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Sponzor</th>
              <th>Stav jednání</th>
              <th>Priorita</th>
              <th>Due date</th>
              <th>Řešitel</th>
              <th>Zadavatel</th>
              <th>Kontakt</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor) => (
              <tr key={sponsor.id}>
                <td>
                  <Link href={sponsorListUrl(params, { detail: String(sponsor.id) })}>{sponsor.name}</Link>
                  {sponsor.ico && <div className="muted small">IČO {sponsor.ico}</div>}
                </td>
                <td>
                  <span className="badge" style={{ color: sponsor.statusColor }}>
                    {sponsor.statusName}
                  </span>
                </td>
                <td>{PRIORITY_LABELS[sponsor.priority]}</td>
                <td className={`due-${dueState(sponsor.dueDate, today) ?? 'none'}`}>{formatDate(sponsor.dueDate)}</td>
                <td>{sponsor.assigneeName ?? <span className="muted">–</span>}</td>
                <td>{sponsor.createdByName}</td>
                <td>
                  {sponsor.contactPhone}
                  {sponsor.contactEmail && <div className="muted small">{sponsor.contactEmail}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sponsors.length === SPONSOR_LIST_LIMIT && (
        <p className="muted">Zobrazeno prvních {SPONSOR_LIST_LIMIT} sponzorů, upřesněte filtr.</p>
      )}

      {params.detail && (
        <SponsorModal
          detail={params.detail}
          statuses={statuses}
          users={users}
          listQuery={listQuery}
          error={params.error}
          saved={params.saved}
          confirmDelete={params.confirmDelete === '1'}
        />
      )}
    </>
  );
}
