import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db/client";
import { drafts, labels } from "~/server/db/schema";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const kind = req.query.kind;
  const rotateRaw = req.query.rotate;
  if (typeof id !== "string" || (kind !== "draft" && kind !== "saved")) {
    return res.status(400).json({ error: "bad_query" });
  }
  const rotate: 0 | 90 = rotateRaw === "90" ? 90 : 0;
  const db = getDb();
  const row =
    kind === "draft"
      ? (await db.select().from(drafts).where(eq(drafts.id, id)).limit(1))[0]
      : (await db.select().from(labels).where(eq(labels.id, id)).limit(1))[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  const config = labelConfigSchema.parse(JSON.parse(row.config));
  const logo = config.logoId ? await loadLogo(db, getLogoStorage(), config.logoId) : null;
  let svg = renderLabelSvg(config, logo);
  svg = rotateSvg(svg, rotate);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(svg);
}
