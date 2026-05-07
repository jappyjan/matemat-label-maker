import { describe, expect, test } from "vitest";
import { detectRecolorable, mimeFromExtension } from "~/server/logos/detect-recolorable";

describe("detectRecolorable", () => {
  test("svg is recolorable", () => {
    expect(detectRecolorable("image/svg+xml")).toBe(true);
  });
  test("png is not recolorable", () => {
    expect(detectRecolorable("image/png")).toBe(false);
  });
  test("jpeg is not recolorable", () => {
    expect(detectRecolorable("image/jpeg")).toBe(false);
  });
});

describe("mimeFromExtension", () => {
  test("returns supported types", () => {
    expect(mimeFromExtension("logo.svg")).toBe("image/svg+xml");
    expect(mimeFromExtension("logo.PNG")).toBe("image/png");
    expect(mimeFromExtension("logo.jpg")).toBe("image/jpeg");
    expect(mimeFromExtension("logo.jpeg")).toBe("image/jpeg");
  });
  test("returns null for unsupported", () => {
    expect(mimeFromExtension("logo.gif")).toBe(null);
    expect(mimeFromExtension("logo")).toBe(null);
  });
});
