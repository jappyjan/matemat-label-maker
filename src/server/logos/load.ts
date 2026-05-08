import { eq } from "drizzle-orm";
import type { Db } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import type { LoadedLogo } from "~/server/label/types";
import type { LogoStorage } from "./storage";

export async function loadLogo(
  db: Db,
  storage: LogoStorage,
  logoId: string,
): Promise<LoadedLogo | null> {
  const rows = await db.select().from(logos).where(eq(logos.id, logoId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const bytes = await storage.read(row.storagePath);
  return {
    id: row.id,
    mimeType: row.mimeType,
    recolorable: row.recolorable,
    bytes,
    text: row.recolorable ? bytes.toString("utf8") : null,
  };
}
