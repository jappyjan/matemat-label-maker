import type { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import formidable, { errors as formidableErrors } from "formidable";
import { readFile, unlink } from "node:fs/promises";
import { getDb } from "~/server/db/client";
import { logos } from "~/server/db/schema";
import {
  detectRecolorable,
  extensionFromMime,
  isAllowedMime,
} from "~/server/logos/detect-recolorable";
import { getLogoStorage } from "~/server/logos/storage";

export const config = {
  api: { bodyParser: false },
};

const MAX_BYTES = 10 * 1024 * 1024;

async function parseForm(req: NextApiRequest) {
  const form = formidable({ maxFileSize: MAX_BYTES, multiples: false });
  return new Promise<{ file: formidable.File }>((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err);
      const fileField = files.file;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;
      if (!file) return reject(new Error("missing_file"));
      resolve({ file });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();

  if (req.method === "GET") {
    const rows = await db.select().from(logos);
    return res.status(200).json(rows);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }

  let file: formidable.File;
  try {
    ({ file } = await parseForm(req));
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (
      code === formidableErrors.biggerThanTotalMaxFileSize ||
      code === formidableErrors.biggerThanMaxFileSize
    ) {
      return res.status(413).json({ error: "too_large" });
    }
    return res.status(400).json({ error: "bad_upload" });
  }

  const mime = file.mimetype ?? "";
  if (!isAllowedMime(mime)) {
    await unlink(file.filepath).catch(() => undefined);
    return res.status(415).json({ error: "unsupported_format" });
  }

  const id = nanoid(12);
  const ext = extensionFromMime(mime);
  const bytes = await readFile(file.filepath);
  await unlink(file.filepath).catch(() => undefined);
  const storage = getLogoStorage();
  const { relativePath } = await storage.save({ id, extension: ext, bytes });

  const row = {
    id,
    filename: file.originalFilename ?? `logo.${ext}`,
    storagePath: relativePath,
    mimeType: mime,
    recolorable: detectRecolorable(mime),
    createdAt: Date.now(),
  };
  await db.insert(logos).values(row);
  return res.status(200).json(row);
}
