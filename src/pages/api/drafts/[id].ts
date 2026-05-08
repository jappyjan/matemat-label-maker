import { type NextApiRequest, type NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { labelConfigSchema } from "~/server/label/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).json({ error: "bad_id" });
  const db = getDb();

  if (req.method === "GET") {
    const row = (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({
      id: row.id,
      config: JSON.parse(row.config) as unknown,
      updatedAt: row.updatedAt,
    });
  }
  if (req.method === "PUT") {
    const parsed = labelConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_config" });
    const result = await db
      .update(drafts)
      .set({ config: JSON.stringify(parsed.data), updatedAt: Date.now() })
      .where(eq(drafts.id, id));
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }
  if (req.method === "DELETE") {
    await db.delete(drafts).where(eq(drafts.id, id));
    return res.status(200).json({ ok: true });
  }
  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
