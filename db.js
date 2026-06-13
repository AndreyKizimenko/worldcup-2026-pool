// Tiny DB adapter. Uses real Postgres (pg) when DATABASE_URL is set (Render + Neon),
// otherwise an in-process Postgres (PGlite) persisted to ./.data so local dev needs
// zero setup. Both speak Postgres SQL and expose the same query(text, params) -> {rows}.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let queryImpl;

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon and most hosted PG require SSL; allow self-signed chains.
    ssl: { rejectUnauthorized: false },
  });
  queryImpl = (text, params) => pool.query(text, params);
  console.log('[db] using Postgres via DATABASE_URL');
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = join(__dirname, '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
  queryImpl = (text, params) => pglite.query(text, params);
  console.log(`[db] using local PGlite at ${dataDir} (set DATABASE_URL for Postgres)`);
}

export const query = (text, params = []) => queryImpl(text, params);

export async function init() {
  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      name_key    TEXT NOT NULL UNIQUE,
      token       TEXT NOT NULL UNIQUE,
      picks       JSONB,
      third_picks JSONB,
      submitted   BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_at TIMESTAMPTZ
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS results (
      id       INTEGER PRIMARY KEY DEFAULT 1,
      picks    JSONB NOT NULL DEFAULT '{}'::jsonb,
      best3rd  JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      entries_open   BOOLEAN NOT NULL DEFAULT TRUE,
      picks_revealed BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await query(`INSERT INTO results (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  await query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
}
