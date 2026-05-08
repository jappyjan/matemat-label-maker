import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "~/server/db/client";
import { drafts, labels } from "~/server/db/schema";
import { z } from "zod";

const promoteSchema = z.object({
  draftId: z.string().min(1),
  name: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  if (req.method === "POST") {
    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "bad_input" });
    const { draftId, name } = parsed.data;

    const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
    if (!draft) return res.status(404).json({ error: "draft_not_found" });

    const id = nanoid(12);
    const now = Date.now();
    db.transaction((tx) => {
      tx.insert(labels).values({
        id,
        name,
        config: draft.config,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.delete(drafts).where(eq(drafts.id, draftId)).run();
    });
    return res.status(200).json({ id });
  }

  if (req.method === "GET") {
    const rows = await db.select().from(labels);
    return res.status(200).json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        config: JSON.parse(row.config),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
