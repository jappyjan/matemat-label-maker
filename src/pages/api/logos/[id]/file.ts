import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import { getLogoStorage } from "~/server/logos/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const db = getDb();
  const row = (await db.select().from(logos).where(eq(logos.id, id)).limit(1))[0];
  if (!row) return res.status(404).end();
  const bytes = await getLogoStorage().read(row.storagePath);
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("Cache-Control", "private, max-age=86400");
  // SVG and other text-based formats are sent as string; binary images as Buffer.
  const isText = row.mimeType.startsWith("image/svg") || row.mimeType.startsWith("text/");
  return res.status(200).send(isText ? bytes.toString("utf-8") : bytes);
}
