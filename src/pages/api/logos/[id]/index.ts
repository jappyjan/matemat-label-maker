import type { NextApiRequest, NextApiResponse } from "next";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/server/db/client";
import { drafts, labels, logos } from "~/server/db/schema";
import { getLogoStorage } from "~/server/logos/storage";

const renameSchema = z.object({ filename: z.string().min(1).max(200) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });
  const db = getDb();

  if (req.method === "PUT") {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    const result = await db
      .update(logos)
      .set({ filename: parsed.data.filename })
      .where(eq(logos.id, id));
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const row = (await db.select().from(logos).where(eq(logos.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    const force = req.query.force === "true";

    // JSON_EXTRACT for SQLite is supported by drizzle's sql tag.
    const usingLabels = await db
      .select({ id: labels.id })
      .from(labels)
      .where(sql`json_extract(${labels.config}, '$.logoId') = ${id}`);
    const usingDrafts = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(sql`json_extract(${drafts.config}, '$.logoId') = ${id}`);

    if ((usingLabels.length || usingDrafts.length) && !force) {
      return res.status(409).json({
        error: "in_use",
        labelCount: usingLabels.length,
        draftCount: usingDrafts.length,
      });
    }

    db.transaction((tx) => {
      if (force) {
        for (const l of usingLabels) {
          const cfg = tx.select().from(labels).where(eq(labels.id, l.id)).limit(1).all()[0];
          if (!cfg) continue;
          const parsedCfg: { logoId: string | null } = JSON.parse(cfg.config) as { logoId: string | null };
          parsedCfg.logoId = null;
          tx.update(labels)
            .set({ config: JSON.stringify(parsedCfg), updatedAt: Date.now() })
            .where(eq(labels.id, l.id))
            .run();
        }
        for (const d of usingDrafts) {
          const cfg = tx.select().from(drafts).where(eq(drafts.id, d.id)).limit(1).all()[0];
          if (!cfg) continue;
          const parsedCfg: { logoId: string | null } = JSON.parse(cfg.config) as { logoId: string | null };
          parsedCfg.logoId = null;
          tx.update(drafts)
            .set({ config: JSON.stringify(parsedCfg), updatedAt: Date.now() })
            .where(eq(drafts.id, d.id))
            .run();
        }
      }
      tx.delete(logos).where(eq(logos.id, id)).run();
    });

    try {
      await getLogoStorage().delete(row.storagePath);
    } catch {
      // file already missing; not fatal.
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).end();
}
