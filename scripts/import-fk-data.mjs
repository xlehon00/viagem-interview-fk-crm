// Import syntetickeho datasetu z ../data/ (sponsors.json, contracts.json,
// invoices.json, bank_fio_*.csv) do DB. Idempotentni: nejdriv smaze sponzory
// a jejich data, pak naimportuje znova. Reference (users, seasons, packages,
// benefits, sponsor_statuses) zustava z db/seed.sql.
//
// Spusteni: node --env-file=.env.local scripts/import-fk-data.mjs
// Po dokonceni se jeste sparovaji bank_payments s invoices podle VS + castky
// (stejna logika jako cron /api/cron/parovani).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.resolve(ROOT, '..', 'data');

const INVOICE_KIND_MAP = {
  NORMAL: 'invoice',
  ADVANCE: 'proforma',
  TAX_DOC: 'tax_document',
  CREDIT_NOTE: 'credit_note',
};

const CSV_FILES = ['bank_fio_hlavni.csv', 'bank_fio_vedlejsi.csv'];

function toHalere(czk) {
  return Math.round(Number(czk) * 100);
}

function parseFioDate(s) {
  const [d, m, y] = s.split('.');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseFioAmount(s) {
  // "-5013,00" nebo "2500,00"
  return toHalere(s.replace(/\s/g, '').replace(',', '.'));
}

function parseFioCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/);
  let i = 0;
  // preskoc hlavickovy blok (az po prvni prazdny radek)
  while (i < lines.length && lines[i].trim() !== '') i++;
  i++;
  // dalsi radek je CSV header
  const header = lines[i].split(';');
  i++;
  const rows = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const cells = line.split(';');
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j] ?? '';
    rows.push(row);
  }
  return rows;
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(DATA_DIR, name), 'utf8'));
}

async function clearExisting(client) {
  // Poradi respektuje FK: nejdriv deti, pak rodice.
  await client.query('delete from sponsor_benefits');
  await client.query('delete from history where sponsor_id is not null');
  await client.query('delete from tasks where sponsor_id is not null');
  await client.query('delete from bank_payments');
  await client.query('delete from invoices');
  await client.query('delete from installments');
  await client.query('delete from contracts');
  await client.query('delete from sponsors');
  // resequencing — po delete zustane sekvencni counter, ale testovaci data
  // maji vlastni ID, takze to vadi az pri `insert ... returning id` dalsich veci.
  for (const t of ['sponsors', 'contracts', 'installments', 'invoices', 'bank_payments']) {
    await client.query(`select setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`);
  }
}

async function importSponsors(client, sponsors) {
  // Mapa JSON id ("S001") -> DB id (serial).
  const map = new Map();
  const createdBy = 1; // Jana Veselá — pevne z db/seed.sql
  const statusId = (await client.query("select id from sponsor_statuses where key = 'agreed'")).rows[0].id;

  for (const s of sponsors) {
    const r = await client.query(
      `insert into sponsors (name, ico, contact_name, contact_phone, contact_email,
                             status_id, priority, created_by, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        s.nazev,
        s.ico,
        s.kontakt?.jmeno ?? null,
        s.kontakt?.telefon ?? null,
        s.kontakt?.email ?? null,
        statusId,
        2,
        createdBy,
        s.sidlo ?? null,
      ],
    );
    map.set(s.id, r.rows[0].id);
  }
  return map;
}

async function importContracts(client, contracts, sponsorMap) {
  const seasons = (await client.query('select id, name from seasons')).rows;
  const seasonByName = new Map(seasons.map((s) => [s.name, s.id]));

  for (const c of contracts) {
    const dbSponsor = sponsorMap.get(c.sponzor_id);
    if (!dbSponsor) throw new Error(`Smlouva ${c.cislo_smlouvy} odkazuje na nezname sponzor ID ${c.sponzor_id}`);
    const seasonId = seasonByName.get(c.sezona);
    if (!seasonId) throw new Error(`Sezona "${c.sezona}" neni v tabulce seasons`);

    const r = await client.query(
      `insert into contracts (sponsor_id, season_id, number, title, total_amount, signed_at)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [dbSponsor, seasonId, c.cislo_smlouvy, c.predmet, toHalere(c.celkem_bez_dph), c.datum_podpisu],
    );
    const contractId = r.rows[0].id;

    for (const ins of c.splatkovy_kalendar) {
      await client.query(
        `insert into installments (contract_id, due_date, amount) values ($1, $2, $3)`,
        [contractId, ins.splatnost, toHalere(ins.castka_bez_dph)],
      );
    }
  }
}

async function importInvoices(client, invoices, sponsorMap) {
  // Dvoufazove: nejdriv vsechny doklady bez vazeb, pak update odkazu na opravovany/zalohu.
  const sponsorsByIco = new Map();
  for (const [, dbId] of sponsorMap) {
    const r = await client.query('select ico from sponsors where id = $1', [dbId]);
    if (r.rows[0]?.ico) sponsorsByIco.set(r.rows[0].ico, dbId);
  }

  const extToDb = new Map(); // JSON id "D0001" -> DB serial
  for (const inv of invoices) {
    const sponsorId = sponsorsByIco.get(inv.odberatel_ico);
    if (!sponsorId) {
      // Doklad pro neznameho odberatele (napr. jiny subjekt, ne klubovy sponzor).
      // Preskoc — tak to resi i ucetnictvi (hleda se jen k existujicim sponzorum).
      continue;
    }
    const kind = INVOICE_KIND_MAP[inv.typ];
    if (!kind) throw new Error(`Neznamy typ dokladu: ${inv.typ} (${inv.id})`);
    const r = await client.query(
      `insert into invoices (sponsor_id, kind, number, variable_symbol, issued_at, due_date,
                             amount, canceled, canceled_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        sponsorId,
        kind,
        inv.cislo_dokladu,
        inv.vs,
        inv.datum_vystaveni,
        inv.datum_splatnosti,
        toHalere(inv.k_uhrade),
        inv.storno === true,
        inv.datum_storna || null,
      ],
    );
    extToDb.set(inv.id, r.rows[0].id);
  }

  // Druha faze: vazby
  for (const inv of invoices) {
    const self = extToDb.get(inv.id);
    if (!self) continue;
    if (inv.opravovany_doklad_id) {
      const target = extToDb.get(inv.opravovany_doklad_id);
      if (target) {
        await client.query('update invoices set corrects_invoice_id = $1 where id = $2', [target, self]);
      }
    }
    if (inv.zaloha_id) {
      const target = extToDb.get(inv.zaloha_id);
      if (target) {
        await client.query('update invoices set advance_invoice_id = $1 where id = $2', [target, self]);
      }
    }
  }

  return extToDb;
}

async function importBankPayments(client) {
  let imported = 0;
  for (const file of CSV_FILES) {
    const text = await readFile(path.join(DATA_DIR, file), 'utf8');
    const rows = parseFioCsv(text);
    for (const row of rows) {
      const amount = parseFioAmount(row['Objem']);
      // Ucetni prehled plateb ma pokryt prichozi platby (od sponzoru).
      // Vydaje (zaporne) preskakujeme — nejsou predmetem parovani faktur.
      if (amount <= 0) continue;
      const bankRef = row['ID pohybu']?.trim();
      if (!bankRef) continue;
      await client.query(
        `insert into bank_payments
           (bank_ref, received_at, amount, variable_symbol, counterparty_account,
            counterparty_name, message)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (bank_ref) do nothing`,
        [
          bankRef,
          parseFioDate(row['Datum']),
          amount,
          row['VS']?.trim() || null,
          [row['Protiúčet'], row['Kód banky']].filter(Boolean).join('/') || null,
          row['Název protiúčtu']?.trim() || null,
          row['Zpráva pro příjemce']?.trim() || null,
        ],
      );
      imported++;
    }
  }
  return imported;
}

async function matchPayments(client) {
  // Stejna logika jako app/api/cron/parovani/route.ts: VS + presna castka.
  // Delame to tady jen pro potreby prohlizeni prehledu (aby reviewer nemusel
  // pouštět cron).
  const payments = (
    await client.query(
      `select id, amount, variable_symbol
       from bank_payments
       where matched_invoice_id is null and amount > 0 and variable_symbol is not null
       order by received_at, id`,
    )
  ).rows;

  const open = (
    await client.query(
      `select id, variable_symbol, amount
       from invoices
       where kind in ('proforma', 'invoice')
         and not canceled
         and not exists (select 1 from bank_payments bp where bp.matched_invoice_id = invoices.id)`,
    )
  ).rows;

  const byVs = new Map();
  for (const inv of open) {
    const key = `${inv.variable_symbol.trim()}:${inv.amount}`;
    if (!byVs.has(key)) byVs.set(key, []);
    byVs.get(key).push(inv);
  }

  let matched = 0;
  for (const p of payments) {
    const key = `${p.variable_symbol.trim()}:${p.amount}`;
    const candidates = byVs.get(key);
    if (!candidates || candidates.length === 0) continue;
    const invoice = candidates.shift();
    await client.query(
      'update bank_payments set matched_invoice_id = $1 where id = $2 and matched_invoice_id is null',
      [invoice.id, p.id],
    );
    matched++;
  }
  return matched;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL neni nastaveno. Pusť s `node --env-file=.env.local scripts/import-fk-data.mjs`.');
    process.exit(1);
  }

  const [sponsors, contracts, invoices] = await Promise.all([
    readJson('sponsors.json'),
    readJson('contracts.json'),
    readJson('invoices.json'),
  ]);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await clearExisting(client);
    const sponsorMap = await importSponsors(client, sponsors);
    await importContracts(client, contracts, sponsorMap);
    const invoiceMap = await importInvoices(client, invoices, sponsorMap);
    const payments = await importBankPayments(client);
    const matched = await matchPayments(client);
    await client.query('commit');
    console.log(
      `Hotovo: ${sponsorMap.size} sponzoru, ${contracts.length} smluv, ` +
        `${invoiceMap.size} dokladu, ${payments} prichozich plateb (${matched} sparovano).`,
    );
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
