import 'server-only';
import { query } from './db';
import type { Halere } from './money';

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

export type BenefitRow = { id: number; name: string; description: string | null; active: boolean; sponsors: number };

export async function listBenefits(options: { activeOnly?: boolean } = {}): Promise<BenefitRow[]> {
  return query<BenefitRow>(
    `select b.id, b.name, b.description, b.active, count(distinct sb.sponsor_id) as sponsors
     from benefits b
     left join sponsor_benefits sb on sb.benefit_id = b.id
     ${options.activeOnly ? 'where b.active' : ''}
     group by b.id
     order by b.name`,
  );
}
