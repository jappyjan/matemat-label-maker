import type { NextApiRequest, NextApiResponse } from "next";
import { inArray } from "drizzle-orm";
import JSZip from "jszip";
import { getDb } from "~/server/db/client";
import { labels } from "~/server/db/schema";
import { CANVAS } from "~/server/label/slots";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import { labelConfigSchema } from "~/server/label/types";
import { loadLogo } from "~/server/logos/load";
import { getLogoStorage } from "~/server/logos/storage";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "label";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const idsParam = req.query.ids;
  if (typeof idsParam !== "string" || idsParam.length === 0) {
    return res.status(400).json({ error: "missing_ids" });
  }
  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: "missing_ids" });

  const format = req.query.format === "png" ? "png" : "svg";
  const scale = Number(req.query.scale ?? "1");
  if (![1, 2, 4].includes(scale)) return res.status(400).json({ error: "bad_scale" });
  const rotate: 0 | 90 = req.query.rotate === "90" ? 90 : 0;

  const db = getDb();
  const rows = await db.select().from(labels).where(inArray(labels.id, ids));
  if (rows.length === 0) return res.status(404).json({ error: "no_labels" });

  const zip = new JSZip();
  const storage = getLogoStorage();

  if (format === "svg") {
    for (const row of rows) {
      const config = labelConfigSchema.parse(JSON.parse(row.config));
      const logo = config.logoId ? await loadLogo(db, storage, config.logoId) : null;
      const svg = rotateSvg(renderLabelSvg(config, logo), rotate);
      zip.file(`${safeFilename(row.name)}.svg`, svg);
    }
  } else {
    const endpoint = process.env.GENERATOR_URL!;
    const user = process.env.GENERATOR_USER!;
    const pass = process.env.GENERATOR_PASS!;
    const base = process.env.INTERNAL_BASE_URL!;
    const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

    let successes = 0;
    for (const row of rows) {
      const svgParams = new URLSearchParams({ id: row.id, kind: "saved" });
      if (rotate === 90) svgParams.set("rotate", "90");
      const svgURL = `${base}/api/labels/${encodeURIComponent(row.id)}/svg?${svgParams.toString()}`;
      const w = (rotate === 90 ? CANVAS.height : CANVAS.width) * scale;
      const h = (rotate === 90 ? CANVAS.width : CANVAS.height) * scale;
      const fullURL = `${endpoint}?svgUrl=${encodeURIComponent(svgURL)}&width=${w}&height=${h}&scale=${scale}`;
      try {
        const resp = await fetch(fullURL, { headers: { Authorization: auth } });
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        zip.file(`${safeFilename(row.name)}@${scale}x.png`, buf);
        successes++;
      } catch {
        // skip
      }
    }
    if (successes === 0) {
      return res.status(502).json({ error: "all_png_failed" });
    }
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="labels.zip"`);
  return res.status(200).send(out);
}
