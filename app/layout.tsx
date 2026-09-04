import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Nav } from './Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'FK Lipov · CRM',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              FK Lipov · CRM
            </Link>
            <Suspense fallback={null}>
              <Nav />
            </Suspense>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
