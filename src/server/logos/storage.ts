import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SaveLogoInput {
  id: string;
  extension: string;
  bytes: Buffer;
}

export class LogoStorage {
  constructor(private readonly rootDir: string) {}

  private async ensureDir() {
    await mkdir(this.rootDir, { recursive: true });
  }

  async save(input: SaveLogoInput): Promise<{ relativePath: string; absolutePath: string }> {
    await this.ensureDir();
    const relative = `${input.id}.${input.extension}`;
    const absolute = path.join(this.rootDir, relative);
    await writeFile(absolute, input.bytes);
    return { relativePath: relative, absolutePath: absolute };
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(path.join(this.rootDir, relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await unlink(path.join(this.rootDir, relativePath));
  }
}

let cachedStorage: LogoStorage | null = null;
export function getLogoStorage(): LogoStorage {
  if (cachedStorage) return cachedStorage;
  const root = process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, "logos")
    : "./data/uploads/logos";
  cachedStorage = new LogoStorage(root);
  return cachedStorage;
}
