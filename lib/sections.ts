export const SPONSOR_LIST_SECTIONS = ['negotiating', 'agreed', 'rejected', 'manage'] as const;
export type SponsorListSection = (typeof SPONSOR_LIST_SECTIONS)[number];

export const SPONSOR_SECTION_LABELS: Record<SponsorListSection, string> = {
  negotiating: 'V jednání',
  agreed: 'Domluveno',
  rejected: 'Bez zájmu',
  manage: 'Správa sponzorů',
};

const SECTION_STATUS_KEYS: Record<SponsorListSection, readonly string[] | null> = {
  negotiating: ['contact', 'waiting', 'sign', 'renewal', 'temp_rejected'],
  agreed: ['agreed'],
  rejected: ['rejected'],
  manage: null,
};

export function parseSponsorSection(value: string | null | undefined): SponsorListSection {
  return SPONSOR_LIST_SECTIONS.find((section) => section === value) ?? 'negotiating';
}

export function statusKeysForSection(section: SponsorListSection): readonly string[] | null {
  return SECTION_STATUS_KEYS[section];
}

export function sectionAfterSave(current: SponsorListSection, statusKey: string): SponsorListSection {
  if (current === 'manage') return current;
  return SPONSOR_LIST_SECTIONS.find((section) => SECTION_STATUS_KEYS[section]?.includes(statusKey)) ?? 'manage';
}

export const SPONSOR_LIST_QUERY_KEYS = ['section', 'q', 'status', 'priority', 'assignee', 'due'] as const;

type QuerySource = string | Record<string, string | undefined>;

export function sponsorListQuery(source: QuerySource, extra: Record<string, string> = {}): string {
  const from =
    typeof source === 'string'
      ? new URLSearchParams(source)
      : new URLSearchParams(
          Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        );
  const query = new URLSearchParams();
  for (const key of SPONSOR_LIST_QUERY_KEYS) {
    const value = from.get(key);
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  return query.toString();
}

export function sponsorListUrl(source: QuerySource, extra: Record<string, string> = {}): string {
  return `/sponzori?${sponsorListQuery(source, extra)}`;
}

export const TASK_VIEWS = ['mine', 'assigned', 'all', 'done'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  mine: 'Moje',
  assigned: 'Zadáno ode mě',
  all: 'Všechny',
  done: 'Hotové',
};

export function parseTaskView(value: string | null | undefined): TaskView {
  return TASK_VIEWS.find((view) => view === value) ?? 'mine';
}

export const CATALOGS = ['protiplneni', 'balicky', 'obdobi'] as const;
export type Catalog = (typeof CATALOGS)[number];

export const CATALOG_LABELS: Record<Catalog, string> = {
  protiplneni: 'Správa protiplnění',
  balicky: 'Správa balíčků',
  obdobi: 'Správa období',
};
