import { describe, expect, test } from "vitest";
import { recolorSvg, extractSvgInner } from "~/server/label/recolor-svg";

const SAMPLE_SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <path d="M10 10 H 90 V 90 H 10 Z" fill="black" />
  <circle cx="50" cy="50" r="20" fill="#000" />
  <rect width="10" height="10" />
</svg>`;

describe("recolorSvg", () => {
  test("replaces fill attributes with target color", () => {
    const out = recolorSvg(SAMPLE_SVG, "#ff0000");
    expect(out).toContain('fill="#ff0000"');
    expect(out).not.toContain('fill="black"');
    expect(out).not.toContain('fill="#000"');
  });

  test("adds fill to elements that lack it", () => {
    const out = recolorSvg(SAMPLE_SVG, "#ff0000");
    expect(out).toMatch(/<rect [^>]*fill="#ff0000"/);
  });
});

describe("extractSvgInner", () => {
  test("returns viewBox and inner content", () => {
    const result = extractSvgInner(SAMPLE_SVG);
    expect(result.viewBox).toBe("0 0 100 100");
    expect(result.inner).toContain("<path");
    expect(result.inner).not.toContain("<svg");
  });

  test("falls back to width/height when no viewBox", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="60"><rect /></svg>';
    expect(extractSvgInner(svg).viewBox).toBe("0 0 50 60");
  });
});
