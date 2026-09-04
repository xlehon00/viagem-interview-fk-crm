import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/sponzori?section=negotiating');
}
