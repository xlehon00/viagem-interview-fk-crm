import { notFound } from 'next/navigation';
import { listBenefits, listPackages, listSeasons } from '@/lib/catalogs';
import { formatDate } from '@/lib/dates';
import { formatCzk } from '@/lib/money';
import { CATALOGS, CATALOG_LABELS, type Catalog } from '@/lib/sections';
import { addBenefit, addPackage, addSeason } from './actions';

const SAVED_MESSAGES: Record<Catalog, string> = {
  protiplneni: 'Protiplnění bylo přidáno.',
  balicky: 'Balíček byl přidán.',
  obdobi: 'Období bylo přidáno.',
};

type Props = {
  params: Promise<{ catalog: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const [{ catalog }, { error, saved }] = await Promise.all([params, searchParams]);
  const key = CATALOGS.find((item) => item === catalog);
  if (!key) notFound();

  return (
    <>
      <div className="page-header">
        <h1>Sponzoři · {CATALOG_LABELS[key]}</h1>
      </div>
      {error && <p className="alert error">{error}</p>}
      {saved && <p className="alert success">{SAVED_MESSAGES[key]}</p>}
      {key === 'protiplneni' && <Benefits />}
      {key === 'balicky' && <Packages />}
      {key === 'obdobi' && <Seasons />}
    </>
  );
}

async function Benefits() {
  const benefits = await listBenefits();
  return (
    <>
      <form action={addBenefit} className="inline-form">
        <input name="name" placeholder="Název protiplnění" required />
        <input name="description" placeholder="Popis" size={40} />
        <button type="submit">Přidat protiplnění</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Protiplnění</th>
            <th>Popis</th>
            <th className="num">Sponzorů</th>
            <th>Aktivní</th>
          </tr>
        </thead>
        <tbody>
          {benefits.map((benefit) => (
            <tr key={benefit.id}>
              <td>{benefit.name}</td>
              <td className="muted">{benefit.description}</td>
              <td className="num">{benefit.sponsors}</td>
              <td>{benefit.active ? 'ano' : 'ne'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

async function Packages() {
  const [packages, seasons] = await Promise.all([listPackages(), listSeasons()]);
  return (
    <>
      <form action={addPackage} className="inline-form">
        <select name="seasonId" required defaultValue={seasons[0]?.id ?? ''} aria-label="Období">
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
        <input name="name" placeholder="Název balíčku" required />
        <input name="price" placeholder="Cena v Kč" inputMode="decimal" required />
        <input name="description" placeholder="Popis" size={40} />
        <button type="submit">Přidat balíček</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Období</th>
            <th>Balíček</th>
            <th className="num">Cena</th>
            <th>Popis</th>
            <th className="num">Smluv</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((item) => (
            <tr key={item.id}>
              <td>{item.seasonName}</td>
              <td>{item.name}</td>
              <td className="num">{formatCzk(item.price)}</td>
              <td className="muted">{item.description}</td>
              <td className="num">{item.contracts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

async function Seasons() {
  const seasons = await listSeasons();
  return (
    <>
      <form action={addSeason} className="inline-form">
        <input name="name" placeholder="Název, např. 2027/28" required />
        <input name="startsOn" type="date" required aria-label="Začátek" />
        <input name="endsOn" type="date" required aria-label="Konec" />
        <button type="submit">Přidat období</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Období</th>
            <th>Od</th>
            <th>Do</th>
            <th className="num">Smluv</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((season) => (
            <tr key={season.id}>
              <td>{season.name}</td>
              <td>{formatDate(season.startsOn)}</td>
              <td>{formatDate(season.endsOn)}</td>
              <td className="num">{season.contracts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
