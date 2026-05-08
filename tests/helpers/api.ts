import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetDbCache } from "~/server/db/client";
import { resetLogoStorage } from "~/server/logos/storage";

export interface ApiTestEnv {
  databasePath: string;
  uploadsDir: string;
  rootDir: string;
  cleanup: () => void;
}

export function setupApiEnv(): ApiTestEnv {
  const root = mkdtempSync(path.join(tmpdir(), "matemat-api-"));
  const databasePath = path.join(root, "test.db");
  const uploadsDir = path.join(root, "uploads");
  const prev = {
    DATABASE_PATH: process.env.DATABASE_PATH,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };
  process.env.DATABASE_PATH = databasePath;
  process.env.UPLOADS_DIR = uploadsDir;
  resetDbCache();
  resetLogoStorage();
  return {
    databasePath,
    uploadsDir,
    rootDir: root,
    cleanup: () => {
      resetDbCache();
      resetLogoStorage();
      if (prev.DATABASE_PATH === undefined) {
        delete process.env.DATABASE_PATH;
      } else {
        process.env.DATABASE_PATH = prev.DATABASE_PATH;
      }
      if (prev.UPLOADS_DIR === undefined) {
        delete process.env.UPLOADS_DIR;
      } else {
        process.env.UPLOADS_DIR = prev.UPLOADS_DIR;
      }
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function loadFreshHandler<T>(modulePath: string): Promise<T> {
  // Vitest caches modules; this forces a re-import so the env vars above are picked up.
  const rand = Math.random().toString(36).slice(2);
  const cacheBust = `?t=${Date.now()}-${rand}`;
  const mod: { default: T } = await import(`${modulePath}${cacheBust}`);
  return mod.default;
}
