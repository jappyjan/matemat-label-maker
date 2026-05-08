import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => {
  env = setupApiEnv();
  process.env.GENERATOR_URL = "http://gen.example/og";
  process.env.GENERATOR_USER = "u";
  process.env.GENERATOR_PASS = "p";
  process.env.INTERNAL_BASE_URL = "http://app.example";
});
afterEach(() => {
  env.cleanup();
  vi.restoreAllMocks();
});

async function importHandler(modulePath: string) {
  const rand = Math.random().toString(36).slice(2);
  const mod = await import(`${modulePath}?cb=${Date.now()}-${rand}`);
  return mod.default;
}

describe("GET /api/matemat-label", () => {
  test("forwards SVG URL to og-image-generator and returns PNG", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const handler = await importHandler("../../src/pages/api/matemat-label/index");
    const { req, res } = createMocks({
      method: "GET", query: { id: "abc", kind: "draft", rotate: "90" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/png");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("svgUrl=");
    expect(callUrl).toContain(encodeURIComponent("http://app.example/api/labels/abc/svg"));
    expect(callUrl).toContain(encodeURIComponent("rotate=90"));
  });

  test("returns 502 if generator fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const handler = await importHandler("../../src/pages/api/matemat-label/index");
    const { req, res } = createMocks({ method: "GET", query: { id: "abc", kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(502);
  });
});
