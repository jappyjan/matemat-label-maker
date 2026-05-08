import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { labelConfigSchema } from "~/server/label/types";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  config: labelConfigSchema.optional(),
}).refine((v) => v.name !== undefined || v.config !== undefined, {
  message: "must update name or config",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });

  if (req.method === "GET") {
    try {
      const db = getDb();
      const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
      if (!row) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({
        id: row.id,
        name: row.name,
        config: JSON.parse(row.config) as unknown,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  if (req.method === "PUT") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    try {
      const db = getDb();
      const update: Record<string, unknown> = { updatedAt: Date.now() };
      if (parsed.data.name !== undefined) update.name = parsed.data.name;
      if (parsed.data.config !== undefined) update.config = JSON.stringify(parsed.data.config);
      const result = await db.update(labels).set(update).where(eq(labels.id, id));
      if (result.changes === 0) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  if (req.method === "DELETE") {
    try {
      const db = getDb();
      await db.delete(labels).where(eq(labels.id, id));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
