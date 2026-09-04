import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const SEED_FILE = path.join(ROOT, 'db', 'seed.sql');
const MIGRATION_NAME = /^\d{3}_[a-z0-9_]+\.sql$/;
const DOWN_MARKER = /^-- down\s*$/m;

function splitMigration(name, sql) {
  const marker = DOWN_MARKER.exec(sql);
  if (!marker) throw new Error(`${name}: chybí část "-- down"`);
  return { up: sql.slice(0, marker.index), down: sql.slice(marker.index + marker[0].length) };
}

async function inTransaction(client, work) {
  await client.query('begin');
  try {
    await work();
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function migrateUp(client, files, applied) {
  const pending = files.filter((file) => !applied.has(file));
  if (pending.length === 0) {
    console.log('Žádné nové migrace.');
    return;
  }
  for (const file of pending) {
    const { up } = splitMigration(file, await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'));
    await inTransaction(client, async () => {
      await client.query(up);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
    });
    console.log(`up    ${file}`);
  }
}

async function migrateDown(client, files, applied) {
  const last = files.filter((file) => applied.has(file)).at(-1);
  if (!last) {
    console.log('Není co vracet.');
    return;
  }
  const { down } = splitMigration(last, await readFile(path.join(MIGRATIONS_DIR, last), 'utf8'));
  await inTransaction(client, async () => {
    await client.query(down);
    await client.query('delete from schema_migrations where name = $1', [last]);
  });
  console.log(`down  ${last}`);
}

async function seed(client) {
  const sql = await readFile(SEED_FILE, 'utf8');
  await inTransaction(client, () => client.query(sql));
  console.log('Testovací data nahrána.');
}

const command = process.argv[2] ?? 'up';
if (!['up', 'down', 'seed'].includes(command)) {
  console.error('Použití: node scripts/migrate.mjs [up|down|seed]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Chybí DATABASE_URL.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => MIGRATION_NAME.test(file)).sort();
  const applied = new Set((await client.query('select name from schema_migrations')).rows.map((row) => row.name));

  if (command === 'up') await migrateUp(client, files, applied);
  if (command === 'down') await migrateDown(client, files, applied);
  if (command === 'seed') await seed(client);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
