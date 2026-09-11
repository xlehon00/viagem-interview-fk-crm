'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { FormError, parseId, readDate, readText } from '@/lib/forms';
import { parseCzk } from '@/lib/money';
import type { Catalog } from '@/lib/sections';
import { requireUser } from '@/lib/session';

const UNIQUE_VIOLATION = '23505';

const DUPLICATE_MESSAGES: Record<Catalog, string> = {
  protiplneni: 'Protiplnění s tímto názvem už existuje.',
  balicky: 'Balíček s tímto názvem už v období existuje.',
  obdobi: 'Období s tímto názvem už existuje.',
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}

async function saveCatalogItem(catalog: Catalog, work: () => Promise<void>): Promise<never> {
  await requireUser();
  try {
    await work();
  } catch (error) {
    if (error instanceof FormError) redirect(`/sponzori/sprava/${catalog}?error=${encodeURIComponent(error.message)}`);
    if (isUniqueViolation(error)) {
      redirect(`/sponzori/sprava/${catalog}?error=${encodeURIComponent(DUPLICATE_MESSAGES[catalog])}`);
    }
    throw error;
  }
  revalidatePath(`/sponzori/sprava/${catalog}`);
  redirect(`/sponzori/sprava/${catalog}?saved=1`);
}

export async function addBenefit(form: FormData) {
  await saveCatalogItem('protiplneni', async () => {
    const name = readText(form, 'name');
    if (!name) throw new FormError('Vyplňte název protiplnění.');
    await query('insert into benefits (name, description) values ($1, $2)', [name, readText(form, 'description')]);
  });
}

export async function addPackage(form: FormData) {
  await saveCatalogItem('balicky', async () => {
    const seasonId = parseId(form.get('seasonId'));
    const name = readText(form, 'name');
    const price = parseCzk(readText(form, 'price') ?? '');
    if (seasonId === null || !name) throw new FormError('Vyplňte období a název balíčku.');
    if (price === null) throw new FormError('Cena balíčku musí být částka v Kč, např. 120 000.');
    await query('insert into packages (season_id, name, price, description) values ($1, $2, $3, $4)', [
      seasonId,
      name,
      price,
      readText(form, 'description'),
    ]);
  });
}

export async function addSeason(form: FormData) {
  await saveCatalogItem('obdobi', async () => {
    const name = readText(form, 'name');
    const startsOn = readDate(form, 'startsOn');
    const endsOn = readDate(form, 'endsOn');
    if (!name || !startsOn || !endsOn) throw new FormError('Vyplňte název, začátek a konec období.');
    if (startsOn >= endsOn) throw new FormError('Konec období musí být po jeho začátku.');
    await query('insert into seasons (name, starts_on, ends_on) values ($1, $2, $3)', [name, startsOn, endsOn]);
  });
}
