import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SESSION_COOKIE, readSessionEmail } from './auth';
import { query } from './db';

export type CurrentUser = { id: number; email: string; name: string };
export type UserOption = { id: number; name: string };

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const cookieStore = await cookies();
  const email = await readSessionEmail(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect(process.env.AUTH_LOGIN_URL ?? '/');

  const [user] = await query<CurrentUser>(
    'select id, email, name from users where lower(email) = lower($1) and active',
    [email],
  );
  if (!user) throw new Error(`Uživatel ${email} nemá přístup do CRM.`);
  return user;
});

export async function listActiveUsers(): Promise<UserOption[]> {
  return query<UserOption>('select id, name from users where active order by name');
}
