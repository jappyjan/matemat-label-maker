import { z } from "zod";

export const labelConfigSchema = z.object({
  name: z.string().default(""),
  subtitle: z.string().default(""),
  size: z.string().default(""),
  price: z.string().default(""),
  footerLine1: z.string().default(""),
  footerLine2: z.string().default(""),
  logoId: z.string().nullable().default(null),
  colors: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
    foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  }).default({ background: "#000000", foreground: "#ffffff" }),
});

export type LabelConfig = z.infer<typeof labelConfigSchema>;

export interface LoadedLogo {
  id: string;
  mimeType: string;
  recolorable: boolean;
  bytes: Buffer;       // raw file bytes
  text: string | null; // SVG content as string when recolorable, else null
}

export const DEFAULT_CONFIG: LabelConfig = labelConfigSchema.parse({});
