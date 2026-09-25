import Link from 'next/link';
import { todayIso } from '@/lib/dates';
import { formatCzk } from '@/lib/money';
import { SPONSOR_LIST_SECTIONS, SPONSOR_SECTION_LABELS, statusKeysForSection } from '@/lib/sections';
import { getSeasonOverview, getStatusOverview } from '@/lib/sponsors';

export default async function SponsorOverviewPage() {
  const [statuses, seasons] = await Promise.all([getStatusOverview(todayIso()), getSeasonOverview()]);
  const sections = SPONSOR_LIST_SECTIONS.filter((section) => section !== 'manage');

  return (
    <>
      <div className="page-header">
        <h1>Sponzoři: Přehled</h1>
      </div>

      <div className="overview-grid">
        <section>
          <h2>Jednání podle stavu</h2>
          <table>
            <thead>
              <tr>
                <th>Stav jednání</th>
                <th className="num">Sponzorů</th>
                <th className="num">Po termínu</th>
              </tr>
            </thead>
            {sections.map((section) => {
              const keys = statusKeysForSection(section) ?? [];
              return (
                <tbody key={section}>
                  <tr>
                    <th colSpan={3}>
                      <Link href={`/sponzori?section=${section}`}>{SPONSOR_SECTION_LABELS[section]}</Link>
                    </th>
                  </tr>
                  {statuses
                    .filter((status) => keys.includes(status.key))
                    .map((status) => (
                      <tr key={status.id}>
                        <td>
                          <span className="badge" style={{ color: status.color }}>
                            {status.name}
                          </span>
                        </td>
                        <td className="num">{status.sponsors}</td>
                        <td className={status.overdue > 0 ? 'num due-overdue' : 'num'}>{status.overdue}</td>
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
        </section>

        <section>
          <h2>Smlouvy podle období</h2>
          {seasons.length === 0 ? (
            <p className="empty">Zatím není založené žádné období.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Období</th>
                  <th className="num">Smluv</th>
                  <th className="num">Smluvně</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((season) => (
                  <tr key={season.seasonName}>
                    <td>{season.seasonName}</td>
                    <td className="num">{season.contracts}</td>
                    <td className="num">{formatCzk(season.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
