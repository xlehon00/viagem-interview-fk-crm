import { describe, expect, it } from 'vitest';
import { FormError } from './forms';
import {
  canChangeStatus,
  diffSponsorCard,
  dueState,
  parsePriority,
  readSponsorForm,
  statusOptions,
  type SponsorCardValues,
  type StatusTransition,
} from './sponsorCard';

const card: SponsorCardValues = {
  name: 'Pekárna U Lípy s.r.o.',
  ico: '27481234',
  contactName: 'Marie Lipová',
  contactPhone: '+420 600 100 201',
  contactEmail: 'marie.lipova@pekarna-ulipy.example',
  statusId: 2,
  priority: 3,
  dueDate: '2026-09-25',
  assigneeId: 1,
  note: null,
};

const statusNames: Record<number, string> = { 2: 'Čekáme na reakci', 6: 'Domluveno' };
const userNames: Record<number, string> = { 1: 'Jana Veselá', 2: 'Tomáš Řezníček' };

const lookups = {
  statusName: (id: number) => statusNames[id] ?? `#${id}`,
  userName: (id: number) => userNames[id] ?? `#${id}`,
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('přechody stavů jednání', () => {
  const transitions: StatusTransition[] = [
    { fromKey: 'contact', toKey: 'waiting' },
    { fromKey: 'waiting', toKey: 'sign' },
    { fromKey: 'sign', toKey: 'agreed' },
    { fromKey: 'agreed', toKey: 'renewal' },
  ];
  const statuses = ['contact', 'waiting', 'sign', 'renewal', 'agreed'].map((key, index) => ({ key, position: index }));

  it('pustí jen povolený další stav nebo ponechání stavu', () => {
    expect(canChangeStatus(transitions, 'waiting', 'sign')).toBe(true);
    expect(canChangeStatus(transitions, 'waiting', 'waiting')).toBe(true);
    expect(canChangeStatus(transitions, 'contact', 'agreed')).toBe(false);
    expect(canChangeStatus(transitions, 'agreed', 'contact')).toBe(false);
  });

  it('nabídne aktuální stav a povolené další stavy v pořadí číselníku', () => {
    expect(statusOptions(statuses, transitions, 'agreed').map((status) => status.key)).toEqual(['renewal', 'agreed']);
    expect(statusOptions(statuses, transitions, 'contact').map((status) => status.key)).toEqual(['contact', 'waiting']);
  });
});

describe('dueState', () => {
  it('rozliší termín po splatnosti, dnešní a budoucí', () => {
    expect(dueState('2026-09-01', '2026-09-02')).toBe('overdue');
    expect(dueState('2026-09-02', '2026-09-02')).toBe('today');
    expect(dueState('2026-09-03', '2026-09-02')).toBe('upcoming');
    expect(dueState(null, '2026-09-02')).toBeNull();
  });
});

describe('parsePriority', () => {
  it('přijme jen 1 až 4', () => {
    expect(parsePriority('4')).toBe(4);
    expect(parsePriority(1)).toBe(1);
    expect(parsePriority('5')).toBeNull();
    expect(parsePriority('')).toBeNull();
  });
});

describe('readSponsorForm', () => {
  it('načte kartu a prázdná pole převede na null', () => {
    const values = readSponsorForm(
      form({ name: '  Restaurace Sokolovna ', statusId: '1', priority: '1', assigneeId: '', ico: '', dueDate: '' }),
    );
    expect(values).toMatchObject({
      name: 'Restaurace Sokolovna',
      statusId: 1,
      priority: 1,
      assigneeId: null,
      ico: null,
      dueDate: null,
    });
  });

  it('odmítne kartu bez názvu, se špatným IČO nebo neplatným datem', () => {
    expect(() => readSponsorForm(form({ name: '', statusId: '1', priority: '2' }))).toThrow(FormError);
    expect(() => readSponsorForm(form({ name: 'X', ico: '1234', statusId: '1', priority: '2' }))).toThrow(
      'IČO musí mít 8 číslic.',
    );
    expect(() => readSponsorForm(form({ name: 'X', statusId: '1', priority: '2', dueDate: '2026-02-31' }))).toThrow(
      FormError,
    );
  });
});

describe('diffSponsorCard', () => {
  it('beze změny nevrací nic', () => {
    expect(diffSponsorCard(card, { ...card }, lookups)).toEqual([]);
  });

  it('do historie zapíše čitelné hodnoty z číselníků', () => {
    const changes = diffSponsorCard(card, { ...card, statusId: 6, priority: 4, assigneeId: 2 }, lookups);
    expect(changes).toEqual([
      { field: 'status', oldValue: 'Čekáme na reakci', newValue: 'Domluveno' },
      { field: 'priority', oldValue: 'Vysoká', newValue: 'Nejvyšší' },
      { field: 'assignee', oldValue: 'Jana Veselá', newValue: 'Tomáš Řezníček' },
    ]);
  });

  it('smazaný termín zapíše jako změnu na prázdnou hodnotu', () => {
    expect(diffSponsorCard(card, { ...card, dueDate: null }, lookups)).toEqual([
      { field: 'due_date', oldValue: '25. 9. 2026', newValue: null },
    ]);
  });
});
