const FILL_ATTR = /\sfill\s*=\s*("[^"]*"|'[^']*')/g;
const SVG_OPEN = /<svg\b[^>]*>/i;
const SVG_CLOSE = /<\/svg>/i;
const PAINTABLE_TAGS = [
  "path", "circle", "ellipse", "rect", "polygon", "polyline", "line", "text",
];

export function recolorSvg(svg: string, color: string): string {
  let out = svg.replace(FILL_ATTR, ` fill="${color}"`);

  for (const tag of PAINTABLE_TAGS) {
    const opener = new RegExp(`<${tag}\\b([^>]*?)(\\s*/)?>`, "g");
    out = out.replace(opener, (match, attrs: string, selfClose: string | undefined) => {
      if (/\sfill\s*=/.test(attrs)) return match;
      const close = selfClose ?? "";
      return `<${tag}${attrs} fill="${color}"${close}>`;
    });
  }

  return out;
}

export function extractSvgInner(svg: string): { viewBox: string; inner: string } {
  const openMatch = SVG_OPEN.exec(svg);
  const closeMatch = SVG_CLOSE.exec(svg);
  if (!openMatch || !closeMatch) {
    return { viewBox: "0 0 100 100", inner: svg };
  }
  const openTag = openMatch[0];
  const inner = svg.slice(openMatch.index + openTag.length, closeMatch.index);

  const viewBoxMatch = /viewBox\s*=\s*"([^"]+)"/i.exec(openTag);
  if (viewBoxMatch?.[1]) {
    return { viewBox: viewBoxMatch[1], inner };
  }
  const widthMatch = /\swidth\s*=\s*"([^"]+)"/i.exec(openTag);
  const heightMatch = /\sheight\s*=\s*"([^"]+)"/i.exec(openTag);
  const w = widthMatch?.[1] ?? "100";
  const h = heightMatch?.[1] ?? "100";
  return { viewBox: `0 0 ${w} ${h}`, inner };
}
