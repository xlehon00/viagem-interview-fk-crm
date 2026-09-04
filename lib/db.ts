import 'server-only';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

const INT8_OID = 20;

types.setTypeParser(INT8_OID, (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Číslo ${value} je mimo bezpečný rozsah.`);
  return parsed;
});

const globalForDb = globalThis as typeof globalThis & { fkCrmPool?: Pool };

export const pool = globalForDb.fkCrmPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== 'production') globalForDb.fkCrmPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function sqlParams() {
  const values: unknown[] = [];
  return {
    values,
    add(value: unknown): string {
      values.push(value);
      return `$${values.length}`;
    },
  };
}
