import { type NextApiRequest, type NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { getDb } from "~/server/db/client";
import { drafts } from "~/server/db/schema";
import { DEFAULT_CONFIG } from "~/server/label/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      const db = getDb();
      const id = nanoid(12);
      const now = Date.now();
      await db.insert(drafts).values({
        id,
        config: JSON.stringify(DEFAULT_CONFIG),
        updatedAt: now,
      });
      return res.status(200).json({ id });
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  if (req.method === "GET") {
    try {
      const db = getDb();
      const rows = await db.select().from(drafts);
      const out = rows.map((row) => ({
        id: row.id,
        config: JSON.parse(row.config) as unknown,
        updatedAt: row.updatedAt,
      }));
      return res.status(200).json(out);
    } catch (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "storage" });
    }
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
