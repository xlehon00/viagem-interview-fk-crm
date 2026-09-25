import { formatDate } from './dates';
import { FormError, parseId, readDate, readText } from './forms';

export const PRIORITIES = [4, 3, 2, 1] as const;
export type Priority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: Priority = 2;

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'Nízká',
  2: 'Střední',
  3: 'Vysoká',
  4: 'Nejvyšší',
};

export function parsePriority(value: unknown): Priority | null {
  const number = Number(value);
  return PRIORITIES.find((priority) => priority === number) ?? null;
}

export const INITIAL_STATUS_KEY = 'contact';

export type StatusTransition = { fromKey: string; toKey: string };

export function canChangeStatus(transitions: readonly StatusTransition[], fromKey: string, toKey: string): boolean {
  return fromKey === toKey || transitions.some((item) => item.fromKey === fromKey && item.toKey === toKey);
}

export function statusOptions<T extends { key: string }>(
  statuses: readonly T[],
  transitions: readonly StatusTransition[],
  currentKey: string,
): T[] {
  return statuses.filter((status) => canChangeStatus(transitions, currentKey, status.key));
}

export type DueState = 'overdue' | 'today' | 'upcoming';

export function dueState(dueDate: string | null, today: string): DueState | null {
  if (!dueDate) return null;
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  return 'upcoming';
}

export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  overdue: 'Po termínu',
  today: 'Dnes',
  week: 'Do 7 dní',
  none: 'Bez termínu',
};

export function parseDueFilter(value: string | null | undefined): DueFilter | undefined {
  return DUE_FILTERS.find((filter) => filter === value);
}

export type SponsorCardValues = {
  name: string;
  ico: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  statusId: number;
  priority: Priority;
  dueDate: string | null;
  assigneeId: number | null;
  note: string | null;
};

export function readSponsorForm(form: FormData): SponsorCardValues {
  const name = readText(form, 'name');
  if (!name) throw new FormError('Vyplňte název sponzora.');

  const ico = readText(form, 'ico');
  if (ico && !/^\d{8}$/.test(ico)) throw new FormError('IČO musí mít 8 číslic.');

  const statusId = parseId(form.get('statusId'));
  if (statusId === null) throw new FormError('Vyberte stav jednání.');

  const priority = parsePriority(form.get('priority'));
  if (priority === null) throw new FormError('Vyberte prioritu.');

  const assigneeRaw = readText(form, 'assigneeId');
  const assigneeId = assigneeRaw === null ? null : parseId(assigneeRaw);
  if (assigneeRaw !== null && assigneeId === null) throw new FormError('Vyberte řešitele.');

  const contactEmail = readText(form, 'contactEmail');
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new FormError('E-mail kontaktu není platný.');
  }

  return {
    name,
    ico,
    contactName: readText(form, 'contactName'),
    contactPhone: readText(form, 'contactPhone'),
    contactEmail,
    statusId,
    priority,
    dueDate: readDate(form, 'dueDate'),
    assigneeId,
    note: readText(form, 'note'),
  };
}

const CARD_FIELDS = [
  { key: 'name', field: 'name', label: 'Název' },
  { key: 'statusId', field: 'status', label: 'Stav jednání' },
  { key: 'priority', field: 'priority', label: 'Priorita' },
  { key: 'dueDate', field: 'due_date', label: 'Due date' },
  { key: 'assigneeId', field: 'assignee', label: 'Řešitel' },
  { key: 'ico', field: 'ico', label: 'IČO' },
  { key: 'contactName', field: 'contact_name', label: 'Kontaktní osoba' },
  { key: 'contactPhone', field: 'contact_phone', label: 'Telefon' },
  { key: 'contactEmail', field: 'contact_email', label: 'E-mail' },
  { key: 'note', field: 'note', label: 'Poznámka' },
] as const satisfies readonly { key: keyof SponsorCardValues; field: string; label: string }[];

export const HISTORY_FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(CARD_FIELDS.map(({ field, label }) => [field, label])),
  created: 'Založení karty',
  deleted: 'Smazání karty',
  benefit: 'Protiplnění',
  task: 'Úkol',
  payment: 'Platba',
};

export type CardChange = { field: string; oldValue: string | null; newValue: string | null };

export type CardLookups = {
  statusName: (id: number) => string;
  userName: (id: number) => string;
};

function displayValue(key: keyof SponsorCardValues, value: string | number | null, lookups: CardLookups) {
  if (value === null) return null;
  switch (key) {
    case 'statusId':
      return lookups.statusName(Number(value));
    case 'assigneeId':
      return lookups.userName(Number(value));
    case 'priority':
      return PRIORITY_LABELS[value as Priority];
    case 'dueDate':
      return formatDate(String(value));
    default:
      return String(value);
  }
}

export function diffSponsorCard(
  before: SponsorCardValues,
  after: SponsorCardValues,
  lookups: CardLookups,
): CardChange[] {
  return CARD_FIELDS.filter(({ key }) => before[key] !== after[key]).map(({ key, field }) => ({
    field,
    oldValue: displayValue(key, before[key], lookups),
    newValue: displayValue(key, after[key], lookups),
  }));
}
