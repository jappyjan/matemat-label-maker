import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
  return {
    databasePath,
    uploadsDir,
    rootDir: root,
    cleanup: () => {
      process.env.DATABASE_PATH = prev.DATABASE_PATH;
      process.env.UPLOADS_DIR = prev.UPLOADS_DIR;
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function loadFreshHandler<T>(modulePath: string): Promise<T> {
  // Vitest caches modules; this forces a re-import so the env vars above are picked up.
  const cacheBust = `?t=${Date.now()}-${Math.random()}`;
  const mod: { default: T } = await import(`${modulePath}${cacheBust}`);
  return mod.default;
}
