import { describe, expect, test } from "vitest";
import { renderLabelSvg, rotateSvg } from "~/server/label/render";
import type { LabelConfig, LoadedLogo } from "~/server/label/types";

const baseConfig: LabelConfig = {
  name: "fritz-kola",
  size: "0,33 L",
  price: "2,00 €",
  footerLine1: "Koffein: 25 mg/100 ml",
  footerLine2: "Zucker: 9,9 g/100 ml",
  logoId: null,
  colors: { background: "#000000", foreground: "#ffffff" },
};

describe("renderLabelSvg", () => {
  test("emits an SVG with the right canvas size", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 630 800"/);
    expect(svg).toMatch(/<rect[^>]*fill="#000000"/);
  });

  test("emits text slots with foreground color", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(svg).toContain("fritz-kola");
    expect(svg).toContain("0,33 L");
    expect(svg).toContain("2,00 €");
    expect(svg).toMatch(/fill="#ffffff"/);
  });

  test("escapes XML-special characters in text", () => {
    const svg = renderLabelSvg(
      { ...baseConfig, name: "A & B <c>" },
      null,
    );
    expect(svg).toContain("A &amp; B &lt;c&gt;");
    expect(svg).not.toContain("A & B <c>");
  });

  test("omits logo block when no logo provided", () => {
    const svg = renderLabelSvg({ ...baseConfig, logoId: null }, null);
    expect(svg).not.toContain("<image");
    expect(svg).not.toMatch(/<g [^>]*data-logo/);
  });

  test("inlines and recolors an SVG logo when recolorable", () => {
    const logo: LoadedLogo = {
      id: "abc",
      mimeType: "image/svg+xml",
      recolorable: true,
      bytes: Buffer.from(""),
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="black" /></svg>',
    };
    const svg = renderLabelSvg(
      { ...baseConfig, logoId: "abc", colors: { background: "#000000", foreground: "#abcdef" } },
      logo,
    );
    expect(svg).toContain('fill="#abcdef"');
    expect(svg).not.toContain('fill="black"');
  });

  test("embeds a PNG logo as a data URI", () => {
    const logo: LoadedLogo = {
      id: "png",
      mimeType: "image/png",
      recolorable: false,
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      text: null,
    };
    const svg = renderLabelSvg({ ...baseConfig, logoId: "png" }, logo);
    expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,/);
  });

  test("auto-shrinks long text", () => {
    const longName = "an extremely long product name that does not fit at all";
    const svg = renderLabelSvg({ ...baseConfig, name: longName }, null);
    const fontSizeMatch = svg.match(new RegExp(`<text[^>]*font-size="(\\d+)"[^>]*>[^<]*<tspan[^>]*>${longName}`));
    expect(fontSizeMatch).not.toBeNull();
    expect(Number(fontSizeMatch![1])).toBeLessThan(96);
  });

  test("short text does not get textLength (avoids glyph stretching)", () => {
    const svg = renderLabelSvg(baseConfig, null);
    // The "0,33 L" is short for its slot — should NOT have textLength
    expect(svg).toMatch(/<tspan[^>]*>0,33 L<\/tspan>/);
    expect(svg).not.toMatch(/<tspan[^>]*textLength[^>]*>0,33 L/);
  });

  test("long text does get textLength (compression safety net)", () => {
    const longName = "an extremely long product name that does not fit at all";
    const svg = renderLabelSvg({ ...baseConfig, name: longName }, null);
    expect(svg).toMatch(new RegExp(`<tspan[^>]*textLength="\\d+"[^>]*>${longName}`));
  });
});

describe("rotateSvg", () => {
  test("returns input unchanged when rotate=0", () => {
    const svg = renderLabelSvg(baseConfig, null);
    expect(rotateSvg(svg, 0)).toBe(svg);
  });

  test("wraps SVG in a rotation group when rotate=90", () => {
    const svg = renderLabelSvg(baseConfig, null);
    const rotated = rotateSvg(svg, 90);
    expect(rotated).toMatch(/viewBox="0 0 800 630"/);
    expect(rotated).toContain("transform=\"rotate(90 0 0) translate(0 -800)\"");
  });
});
