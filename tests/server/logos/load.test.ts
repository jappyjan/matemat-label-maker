import { afterEach, describe, expect, test } from "vitest";
import { setupTestDb, type TestDb } from "../../helpers/test-db";
import { logos } from "~/server/db/schema";
import { LogoStorage } from "~/server/logos/storage";
import { loadLogo } from "~/server/logos/load";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let testDb: TestDb;
let tmpDir: string;
let storage: LogoStorage;

afterEach(() => {
  testDb?.cleanup();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadLogo", () => {
  test("returns null for unknown id", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const result = await loadLogo(testDb.db, storage, "missing");
    expect(result).toBeNull();
  });

  test("returns LoadedLogo for SVG with text", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const svg = "<svg/>";
    await storage.save({ id: "s1", extension: "svg", bytes: Buffer.from(svg) });
    await testDb.db.insert(logos).values({
      id: "s1",
      filename: "logo.svg",
      storagePath: "s1.svg",
      mimeType: "image/svg+xml",
      recolorable: true,
      createdAt: Date.now(),
    });
    const result = await loadLogo(testDb.db, storage, "s1");
    expect(result).not.toBeNull();
    expect(result!.recolorable).toBe(true);
    expect(result!.text).toBe(svg);
  });

  test("returns LoadedLogo for PNG without text", async () => {
    testDb = setupTestDb();
    tmpDir = mkdtempSync(path.join(tmpdir(), "load-logo-"));
    storage = new LogoStorage(tmpDir);
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await storage.save({ id: "p1", extension: "png", bytes });
    await testDb.db.insert(logos).values({
      id: "p1",
      filename: "logo.png",
      storagePath: "p1.png",
      mimeType: "image/png",
      recolorable: false,
      createdAt: Date.now(),
    });
    const result = await loadLogo(testDb.db, storage, "p1");
    expect(result).not.toBeNull();
    expect(result!.recolorable).toBe(false);
    expect(result!.text).toBeNull();
    expect(result!.bytes).toEqual(bytes);
  });
});
