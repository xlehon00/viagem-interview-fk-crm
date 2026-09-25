import 'server-only';
import { query } from './db';
import type { Halere } from './money';

export const BENEFIT_CATEGORIES = ['online', 'stadium', 'jerseys', 'matchday', 'vip', 'pr', 'csr'] as const;
export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];

export const BENEFIT_CATEGORY_LABELS: Record<BenefitCategory, string> = {
  online: 'Online',
  stadium: 'Stadion',
  jerseys: 'Dresy',
  matchday: 'Matchday',
  vip: 'VIP',
  pr: 'PR',
  csr: 'CSR',
};

export function parseBenefitCategory(value: unknown): BenefitCategory | null {
  return BENEFIT_CATEGORIES.find((category) => category === value) ?? null;
}

export type SeasonRow = { id: number; name: string; startsOn: string; endsOn: string; contracts: number };

export async function listSeasons(): Promise<SeasonRow[]> {
  return query<SeasonRow>(
    `select se.id, se.name, to_char(se.starts_on, 'YYYY-MM-DD') as "startsOn",
            to_char(se.ends_on, 'YYYY-MM-DD') as "endsOn", count(c.id) as contracts
     from seasons se
     left join contracts c on c.season_id = se.id
     group by se.id
     order by se.starts_on desc`,
  );
}

export type PackageRow = {
  id: number;
  seasonName: string;
  name: string;
  price: Halere;
  description: string | null;
  contracts: number;
};

export async function listPackages(): Promise<PackageRow[]> {
  return query<PackageRow>(
    `select p.id, se.name as "seasonName", p.name, p.price, p.description, count(c.id) as contracts
     from packages p
     join seasons se on se.id = p.season_id
     left join contracts c on c.package_id = p.id
     group by p.id, se.id
     order by se.starts_on desc, p.price desc`,
  );
}

export type BenefitRow = {
  id: number;
  category: BenefitCategory;
  name: string;
  description: string | null;
  active: boolean;
  sponsors: number;
};

export async function listBenefits(options: { activeOnly?: boolean } = {}): Promise<BenefitRow[]> {
  const rows = await query<BenefitRow>(
    `select b.id, b.category, b.name, b.description, b.active, count(distinct sb.sponsor_id) as sponsors
     from benefits b
     left join sponsor_benefits sb on sb.benefit_id = b.id
     ${options.activeOnly ? 'where b.active' : ''}
     group by b.id
     order by b.name`,
  );
  return rows.sort(
    (a, b) => BENEFIT_CATEGORIES.indexOf(a.category) - BENEFIT_CATEGORIES.indexOf(b.category),
  );
}
