import { GLYPH_WIDTHS, FALLBACK_WIDTH } from "./glyph-widths";

export function measureTextWidth(text: string, fontSize: number): number {
  let total = 0;
  for (const char of text) {
    total += GLYPH_WIDTHS[char] ?? FALLBACK_WIDTH;
  }
  return total * fontSize;
}

export function fitFontSize(
  text: string,
  maxWidth: number,
  defaultSize: number,
  minSize: number,
): number {
  if (text.length === 0) return defaultSize;
  if (measureTextWidth(text, defaultSize) <= maxWidth) return defaultSize;
  for (let size = defaultSize; size >= minSize; size--) {
    if (measureTextWidth(text, size) <= maxWidth) return size;
  }
  return minSize;
}
