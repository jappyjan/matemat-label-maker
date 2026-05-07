import { describe, expect, test } from "vitest";
import { measureTextWidth, fitFontSize } from "~/server/label/fit-font";

describe("measureTextWidth", () => {
  test("scales linearly with font size", () => {
    const w20 = measureTextWidth("Hello", 20);
    const w40 = measureTextWidth("Hello", 40);
    expect(w40).toBeCloseTo(w20 * 2, 1);
  });

  test("empty string is zero", () => {
    expect(measureTextWidth("", 50)).toBe(0);
  });
});

describe("fitFontSize", () => {
  test("returns default size when text fits", () => {
    expect(fitFontSize("Hi", 1000, 96, 24)).toBe(96);
  });

  test("shrinks until it fits", () => {
    const fitted = fitFontSize(
      "an extremely long product name that overflows",
      300,
      96,
      24,
    );
    expect(fitted).toBeLessThan(96);
    expect(measureTextWidth("an extremely long product name that overflows", fitted)).toBeLessThanOrEqual(300);
  });

  test("never goes below minimum", () => {
    expect(fitFontSize("x".repeat(500), 10, 96, 24)).toBe(24);
  });
});
