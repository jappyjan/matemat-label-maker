import type { NextApiRequest, NextApiResponse } from "next";
import { generateLabelPng } from "./generate-label";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id;
  const kind = req.query.kind;
  const rotate = req.query.rotate;
  if (typeof id !== "string" || (kind !== "draft" && kind !== "saved")) {
    return res.status(400).json({ error: "bad_query" });
  }
  const endpoint = process.env.GENERATOR_URL;
  const username = process.env.GENERATOR_USER;
  const password = process.env.GENERATOR_PASS;
  const baseURL = process.env.INTERNAL_BASE_URL;
  if (!endpoint || !username || !password || !baseURL) {
    return res.status(500).json({ error: "generator_not_configured" });
  }
  const svgParams = new URLSearchParams({ id, kind });
  if (rotate === "90") svgParams.set("rotate", "90");
  const svgURL = `${baseURL}/api/labels/${encodeURIComponent(id)}/svg?${svgParams.toString()}`;
  try {
    const blob = await generateLabelPng(svgURL, { endpoint, username, password });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(await blob.arrayBuffer()));
  } catch (err) {
    return res.status(502).json({ error: "generator_failed", detail: String(err) });
  }
}
