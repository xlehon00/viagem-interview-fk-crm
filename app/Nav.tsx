'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CATALOGS,
  CATALOG_LABELS,
  SPONSOR_SECTION_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  parseSponsorSection,
  parseTaskView,
  type SponsorListSection,
} from '@/lib/sections';

type NavItem = { href: string; label: string; active: boolean };

const AGENDAS = [
  { prefix: '/sponzori', href: '/sponzori?section=negotiating', label: 'Sponzoři' },
  { prefix: '/ukoly', href: '/ukoly?view=mine', label: 'Úkoly' },
];

export function AgendaNav() {
  const pathname = usePathname();

  return (
    <nav className="agenda-nav">
      {AGENDAS.map((agenda) => (
        <Link
          key={agenda.prefix}
          href={agenda.href}
          className={pathname.startsWith(agenda.prefix) ? 'agenda-link active' : 'agenda-link'}
        >
          {agenda.label}
        </Link>
      ))}
    </nav>
  );
}

export function SectionNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname.startsWith('/ukoly')) {
    const view = parseTaskView(searchParams.get('view'));
    return (
      <SectionLinks
        items={TASK_VIEWS.map((key) => ({
          href: `/ukoly?view=${key}`,
          label: TASK_VIEW_LABELS[key],
          active: view === key,
        }))}
      />
    );
  }

  if (pathname.startsWith('/sponzori')) {
    const section = parseSponsorSection(searchParams.get('section'));
    const listItem = (key: SponsorListSection): NavItem => ({
      href: `/sponzori?section=${key}`,
      label: SPONSOR_SECTION_LABELS[key],
      active: pathname === '/sponzori' && section === key,
    });
    return (
      <SectionLinks
        items={[
          listItem('negotiating'),
          listItem('agreed'),
          listItem('rejected'),
          { href: '/sponzori/prehled', label: 'Přehled', active: pathname === '/sponzori/prehled' },
          listItem('manage'),
          ...CATALOGS.map((catalog) => ({
            href: `/sponzori/sprava/${catalog}`,
            label: CATALOG_LABELS[catalog],
            active: pathname === `/sponzori/sprava/${catalog}`,
          })),
        ]}
      />
    );
  }

  return null;
}

function SectionLinks({ items }: { items: NavItem[] }) {
  return (
    <nav className="section-nav">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.active ? 'nav-link active' : 'nav-link'}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
