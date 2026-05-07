import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LogoStorage } from "~/server/logos/storage";

let tmpDir: string;
afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("LogoStorage", () => {
  test("writes a logo and reads it back", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "logos-test-"));
    const storage = new LogoStorage(tmpDir);
    const result = await storage.save({ id: "abc", extension: "svg", bytes: Buffer.from("<svg/>") });
    expect(result.relativePath).toMatch(/^abc\.svg$/);
    const buf = await storage.read("abc.svg");
    expect(buf.toString()).toBe("<svg/>");
  });

  test("delete removes the file", async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "logos-test-"));
    const storage = new LogoStorage(tmpDir);
    await storage.save({ id: "x", extension: "png", bytes: Buffer.from("png") });
    await storage.delete("x.png");
    await expect(storage.read("x.png")).rejects.toThrow();
  });
});
