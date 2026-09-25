'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query, transaction } from '@/lib/db';
import { FormError, parseId, readText } from '@/lib/forms';
import { parseSponsorSection, sectionAfterSave, sponsorListUrl } from '@/lib/sections';
import { listActiveUsers, requireUser } from '@/lib/session';
import {
  INITIAL_STATUS_KEY,
  canChangeStatus,
  diffSponsorCard,
  readSponsorForm,
  type SponsorCardValues,
} from '@/lib/sponsorCard';
import {
  insertHistory,
  insertSponsor,
  listStatusTransitions,
  listStatuses,
  lockSponsorCard,
  updateSponsor,
  type StatusRow,
} from '@/lib/sponsors';
import { insertTask, readTaskForm, type NewTask } from '@/lib/tasks';

function listQueryOf(form: FormData): string {
  const value = form.get('listQuery');
  return typeof value === 'string' ? value : '';
}

function backWithError(form: FormData, detail: string, error: unknown): never {
  if (!(error instanceof FormError)) throw error;
  redirect(sponsorListUrl(listQueryOf(form), { detail, error: error.message }));
}

function requireSponsorId(form: FormData): number {
  const id = parseId(form.get('sponsorId'));
  if (id === null) throw new Error('Chybí identifikátor sponzora.');
  return id;
}

async function loadCardLookups(values: SponsorCardValues) {
  const [statuses, transitions, users] = await Promise.all([
    listStatuses(),
    listStatusTransitions(),
    listActiveUsers(),
  ]);
  const status = statuses.find((item) => item.id === values.statusId);
  if (!status) throw new FormError('Vybraný stav jednání neexistuje.');
  if (values.assigneeId !== null && !users.some((user) => user.id === values.assigneeId)) {
    throw new FormError('Vybraný řešitel nemá přístup do CRM.');
  }
  return { statuses, transitions, users, status };
}

export async function createSponsor(form: FormData) {
  const user = await requireUser();
  let values: SponsorCardValues;
  let status: StatusRow;
  try {
    values = readSponsorForm(form);
    ({ status } = await loadCardLookups(values));
    if (status.key !== INITIAL_STATUS_KEY) throw new FormError('Nový sponzor začíná ve stavu Kontaktovat.');
  } catch (error) {
    backWithError(form, 'new', error);
  }

  const sponsorId = await transaction(async (client) => {
    const id = await insertSponsor(client, values, user.id);
    await insertHistory(client, { sponsorId: id, userId: user.id, field: 'created', newValue: values.name });
    return id;
  });

  revalidatePath('/sponzori');
  const section = sectionAfterSave(parseSponsorSection(new URLSearchParams(listQueryOf(form)).get('section')), status.key);
  redirect(sponsorListUrl(`section=${section}`, { detail: String(sponsorId), saved: 'created' }));
}

export async function saveSponsor(form: FormData) {
  const user = await requireUser();
  const sponsorId = requireSponsorId(form);
  const detail = String(sponsorId);
  let values: SponsorCardValues;
  let lookups: Awaited<ReturnType<typeof loadCardLookups>>;
  try {
    values = readSponsorForm(form);
    lookups = await loadCardLookups(values);
  } catch (error) {
    backWithError(form, detail, error);
  }

  try {
    await transaction(async (client) => {
      const before = await lockSponsorCard(client, sponsorId);
      if (!before) throw new FormError('Sponzor neexistuje nebo byl smazán.');
      const from = lookups.statuses.find((status) => status.id === before.statusId);
      if (!from || !canChangeStatus(lookups.transitions, from.key, lookups.status.key)) {
        throw new FormError(`Ze stavu ${from?.name ?? '?'} nejde přejít na stav ${lookups.status.name}.`);
      }
      const changes = diffSponsorCard(before, values, {
        statusName: (id) => lookups.statuses.find((status) => status.id === id)?.name ?? `#${id}`,
        userName: (id) => lookups.users.find((item) => item.id === id)?.name ?? `#${id}`,
      });
      if (changes.length === 0) return;
      await updateSponsor(client, sponsorId, values);
      for (const change of changes) {
        await insertHistory(client, { sponsorId, userId: user.id, ...change });
      }
    });
  } catch (error) {
    backWithError(form, detail, error);
  }

  revalidatePath('/sponzori');
  const listQuery = listQueryOf(form);
  const current = parseSponsorSection(new URLSearchParams(listQuery).get('section'));
  const next = sectionAfterSave(current, lookups.status.key);
  const base = next === current ? listQuery : `section=${next}`;
  redirect(sponsorListUrl(base, { detail, saved: 'card' }));
}

export async function deleteSponsor(form: FormData) {
  const user = await requireUser();
  const sponsorId = requireSponsorId(form);

  await transaction(async (client) => {
    const { rows } = await client.query<{ name: string }>(
      `update sponsors set deleted_at = now(), updated_at = now()
       where id = $1 and deleted_at is null
       returning name`,
      [sponsorId],
    );
    if (rows[0]) {
      await insertHistory(client, { sponsorId, userId: user.id, field: 'deleted', oldValue: rows[0].name });
    }
  });

  revalidatePath('/sponzori');
  redirect(sponsorListUrl(listQueryOf(form), { deleted: '1' }));
}

export async function addSponsorBenefit(form: FormData) {
  const user = await requireUser();
  const sponsorId = requireSponsorId(form);
  const detail = String(sponsorId);
  const benefitId = parseId(form.get('benefitId'));
  const seasonId = parseId(form.get('seasonId'));
  const quantity = parseId(form.get('quantity'));
  if (benefitId === null || seasonId === null || quantity === null) {
    backWithError(form, detail, new FormError('Vyberte protiplnění, období a počet.'));
  }

  const [names] = await query<{ benefit: string; season: string }>(
    `select b.name as benefit, se.name as season
     from benefits b
     join seasons se on se.id = $2
     where b.id = $1 and b.active`,
    [benefitId, seasonId],
  );
  if (!names) backWithError(form, detail, new FormError('Vybrané protiplnění nebo období neexistuje.'));

  await transaction(async (client) => {
    await client.query(
      `insert into sponsor_benefits (sponsor_id, benefit_id, season_id, quantity, note)
       values ($1, $2, $3, $4, $5)`,
      [sponsorId, benefitId, seasonId, quantity, readText(form, 'note')],
    );
    await insertHistory(client, {
      sponsorId,
      userId: user.id,
      field: 'benefit',
      newValue: `${names.benefit} × ${quantity} (${names.season})`,
    });
  });

  revalidatePath('/sponzori');
  redirect(sponsorListUrl(listQueryOf(form), { detail, saved: 'benefit' }));
}

export async function addSponsorTask(form: FormData) {
  const user = await requireUser();
  const sponsorId = requireSponsorId(form);
  const detail = String(sponsorId);
  let task: NewTask;
  try {
    task = readTaskForm(form);
  } catch (error) {
    backWithError(form, detail, error);
  }

  await transaction(async (client) => {
    await insertTask(client, { ...task, sponsorId, createdBy: user.id });
    await insertHistory(client, { sponsorId, userId: user.id, field: 'task', newValue: task.title });
  });

  revalidatePath('/sponzori');
  revalidatePath('/ukoly');
  redirect(sponsorListUrl(listQueryOf(form), { detail, saved: 'task' }));
}
