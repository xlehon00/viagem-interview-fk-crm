import { isIsoDate } from './dates';

export class FormError extends Error {}

export function readText(form: FormData, name: string): string | null {
  const value = form.get(name);
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? null : text;
}

export function parseId(value: unknown): number | null {
  const id = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function readDate(form: FormData, name: string): string | null {
  const text = readText(form, name);
  if (text === null) return null;
  if (!isIsoDate(text)) throw new FormError('Zadané datum není platné.');
  return text;
}
