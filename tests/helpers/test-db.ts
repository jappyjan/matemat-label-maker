import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type Db } from "~/server/db/client";
import type Database from "better-sqlite3";

export interface TestDb {
  db: Db;
  sqlite: Database.Database;
  cleanup: () => void;
}

export function setupTestDb(): TestDb {
  const dir = mkdtempSync(path.join(tmpdir(), "matemat-test-"));
  const dbPath = path.join(dir, "test.db");
  const { db, sqlite } = createDb({ databasePath: dbPath });
  return {
    db,
    sqlite,
    cleanup: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
