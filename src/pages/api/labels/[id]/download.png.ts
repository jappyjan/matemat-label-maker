import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { CANVAS } from "~/server/label/slots";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  const scale = Number(req.query.scale ?? "1");
  if (![1, 2, 4].includes(scale)) return res.status(400).json({ error: "bad_scale" });
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;

  const db = getDb();
  const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const endpoint = process.env.GENERATOR_URL!;
  const user = process.env.GENERATOR_USER!;
  const pass = process.env.GENERATOR_PASS!;
  const base = process.env.INTERNAL_BASE_URL!;

  const svgParams = new URLSearchParams({ id, kind: "saved" });
  if (rotate === 90) svgParams.set("rotate", "90");
  const svgURL = `${base}/api/labels/${encodeURIComponent(id)}/svg?${svgParams.toString()}`;
  const w = (rotate === 90 ? CANVAS.height : CANVAS.width) * scale;
  const h = (rotate === 90 ? CANVAS.width : CANVAS.height) * scale;
  const fullURL = `${endpoint}?svgUrl=${encodeURIComponent(svgURL)}&width=${w}&height=${h}&scale=${scale}`;

  try {
    const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    const resp = await fetch(fullURL, { headers: { Authorization: auth } });
    if (!resp.ok) {
      return res.status(502).json({ error: "generator_failed", detail: await resp.text() });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename(row.name)}@${scale}x.png"`,
    );
    return res.status(200).send(Buffer.from(await resp.arrayBuffer()));
  } catch (err) {
    return res.status(502).json({ error: "generator_failed", detail: String(err) });
  }
}
