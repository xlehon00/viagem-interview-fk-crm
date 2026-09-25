import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AgendaNav, SectionNav } from './Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'FK Lipov · CRM',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            FK Lipov · CRM
          </Link>
          <AgendaNav />
        </header>
        <div className="shell">
          <aside className="sidebar">
            <Suspense fallback={null}>
              <SectionNav />
            </Suspense>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
