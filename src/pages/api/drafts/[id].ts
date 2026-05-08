import { type NextApiRequest, type NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { labelConfigSchema } from "~/server/label/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });

  if (req.method === "GET") {
    try {
      const db = getDb();
      const row = (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0];
      if (!row) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({
        id: row.id,
        config: JSON.parse(row.config) as unknown,
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  if (req.method === "PUT") {
    const parsed = labelConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_config" });
    try {
      const db = getDb();
      const result = await db
        .update(drafts)
        .set({ config: JSON.stringify(parsed.data), updatedAt: Date.now() })
        .where(eq(drafts.id, id));
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
      await db.delete(drafts).where(eq(drafts.id, id));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
