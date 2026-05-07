const ALLOWED_MIMES = ["image/svg+xml", "image/png", "image/jpeg"] as const;
export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export function detectRecolorable(mimeType: string): boolean {
  return mimeType === "image/svg+xml";
}

export function mimeFromExtension(filename: string): AllowedMime | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "svg": return "image/svg+xml";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    default: return null;
  }
}

export function extensionFromMime(mime: AllowedMime): string {
  switch (mime) {
    case "image/svg+xml": return "svg";
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
  }
}

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}
