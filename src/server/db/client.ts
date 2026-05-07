import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";

import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(options: { databasePath: string }) {
  mkdirSync(path.dirname(options.databasePath), { recursive: true });
  const sqlite = new Database(options.databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve("drizzle/migrations") });

  return { db, sqlite };
}

let cached: { db: Db; sqlite: Database.Database } | null = null;

export function getDb(): Db {
  if (cached) return cached.db;
  const databasePath = process.env.DATABASE_PATH ?? "./data/matemat.db";
  cached = createDb({ databasePath });
  return cached.db;
}
