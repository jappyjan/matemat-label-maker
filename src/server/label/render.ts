import { CANVAS, SLOTS, type SlotKey } from "./slots";
import { fitFontSize, measureTextWidth } from "./fit-font";
import { extractSvgInner, recolorSvg } from "./recolor-svg";
import type { LabelConfig, LoadedLogo } from "./types";

const TEXT_SLOTS: Array<{ key: Exclude<SlotKey, "logo">; field: keyof Pick<LabelConfig, "name" | "size" | "price" | "footerLine1" | "footerLine2"> }> = [
  { key: "name",        field: "name" },
  { key: "size",        field: "size" },
  { key: "price",       field: "price" },
  { key: "footerLine1", field: "footerLine1" },
  { key: "footerLine2", field: "footerLine2" },
];

const MIN_FONT = 24;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderTextSlot(text: string, slot: typeof SLOTS[Exclude<SlotKey, "logo">], color: string): string {
  if (!text) return "";
  const fontSize = fitFontSize(text, slot.width, slot.defaultFontSize, MIN_FONT);
  const naturalWidth = measureTextWidth(text, fontSize);
  const safe = escapeXml(text);
  // Only emit textLength when text would otherwise overflow the slot — otherwise
  // lengthAdjust=spacingAndGlyphs would visually stretch short text.
  const lengthAttrs = naturalWidth > slot.width
    ? ` textLength="${slot.width}" lengthAdjust="spacingAndGlyphs"`
    : "";
  return `<text font-family="Inter" font-size="${fontSize}" fill="${color}"><tspan x="${slot.x}" y="${slot.y}"${lengthAttrs}>${safe}</tspan></text>`;
}

function renderLogo(logo: LoadedLogo | null, foreground: string): string {
  if (!logo) return "";
  const slot = SLOTS.logo;
  if (logo.recolorable && logo.text) {
    const recolored = recolorSvg(logo.text, foreground);
    const { viewBox, inner } = extractSvgInner(recolored);
    return `<svg x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }
  const base64 = logo.bytes.toString("base64");
  return `<image x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" preserveAspectRatio="xMidYMid meet" href="data:${logo.mimeType};base64,${base64}" />`;
}

export function renderLabelSvg(config: LabelConfig, logo: LoadedLogo | null): string {
  const bg = config.colors.background;
  const fg = config.colors.foreground;
  const textParts = TEXT_SLOTS.map(({ key, field }) =>
    renderTextSlot(config[field], SLOTS[key], fg),
  ).join("");
  const logoPart = renderLogo(logo, fg);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">`,
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${bg}"/>`,
    logoPart,
    textParts,
    `</svg>`,
  ].join("");
}

export function rotateSvg(svg: string, rotate: 0 | 90): string {
  if (rotate === 0) return svg;
  // SVG transforms apply right-to-left: translate(0,-800) shifts the canvas to y∈[-800,0],
  // then rotate(90 0 0) maps (x,y)→(-y,x), landing inside the new 800×630 viewBox.
  return svg
    .replace(
      /<svg([^>]*)>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.height}" height="${CANVAS.width}" viewBox="0 0 ${CANVAS.height} ${CANVAS.width}"><g transform="rotate(90 0 0) translate(0 -${CANVAS.height})">`,
    )
    .replace(/<\/svg>$/, "</g></svg>");
}
