import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb } from "~/server/db/client";

describe("createDb", () => {
  test("creates the database file and runs migrations on first call", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "matemat-test-"));
    try {
      const dbPath = path.join(dir, "test.db");
      const { db, sqlite } = createDb({ databasePath: dbPath });
      const tables = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);
      expect(names).toContain("logos");
      expect(names).toContain("labels");
      expect(names).toContain("drafts");
      sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
