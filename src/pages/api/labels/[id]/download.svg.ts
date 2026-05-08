import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  if (typeof id !== "string") return res.status(400).end();
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;

  const db = getDb();
  const row = (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const config = labelConfigSchema.parse(JSON.parse(row.config));
  const logo = config.logoId ? await loadLogo(db, getLogoStorage(), config.logoId) : null;
  const svg = rotateSvg(renderLabelSvg(config, logo), rotate);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}.svg"`);
  return res.status(200).send(svg);
}
