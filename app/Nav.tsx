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
} from '@/lib/sections';

type NavItem = { href: string; label: string; active: boolean };

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = parseSponsorSection(searchParams.get('section'));
  const view = parseTaskView(searchParams.get('view'));
  const onSponsorList = pathname === '/sponzori';

  const listItem = (key: 'negotiating' | 'agreed' | 'rejected' | 'manage'): NavItem => ({
    href: `/sponzori?section=${key}`,
    label: SPONSOR_SECTION_LABELS[key],
    active: onSponsorList && section === key,
  });

  const sponsorItems: NavItem[] = [
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
  ];

  const taskItems: NavItem[] = TASK_VIEWS.map((key) => ({
    href: `/ukoly?view=${key}`,
    label: TASK_VIEW_LABELS[key],
    active: pathname === '/ukoly' && view === key,
  }));

  return (
    <nav className="nav">
      <NavGroup title="Sponzoři" items={sponsorItems} />
      <NavGroup title="Úkoly" items={taskItems} />
    </nav>
  );
}

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="nav-group">
      <div className="nav-group-title">{title}</div>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.active ? 'nav-link active' : 'nav-link'}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
