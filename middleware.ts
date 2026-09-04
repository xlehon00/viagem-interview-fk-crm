import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionEmail } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const email = await readSessionEmail(request.cookies.get(SESSION_COOKIE)?.value);
  if (email) return NextResponse.next();

  const loginUrl = process.env.AUTH_LOGIN_URL;
  if (!loginUrl) return new NextResponse('Přihlášení není nastavené.', { status: 503 });

  const target = new URL(loginUrl);
  target.searchParams.set('return_to', request.nextUrl.href);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
