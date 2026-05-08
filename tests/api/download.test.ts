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
afterEach(() => { env.cleanup(); vi.restoreAllMocks(); });

async function importHandler(modulePath: string) {
  const rand = Math.random().toString(36).slice(2);
  const mod = await import(`${modulePath}?cb=${Date.now()}-${rand}`);
  return mod.default;
}

async function makeLabel(name = "Test") {
  const drafts = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await drafts(post.req, post.res);
  const draftId = post.res._getJSONData().id;
  const promote = await importHandler("../../src/pages/api/labels/index");
  const promoted = createMocks({ method: "POST", body: { draftId, name } });
  await promote(promoted.req, promoted.res);
  return promoted.res._getJSONData().id;
}

describe("download.svg", () => {
  test("returns SVG with attachment disposition", async () => {
    const id = await makeLabel("Fritz");
    const handler = await importHandler("../../src/pages/api/labels/[id]/download.svg");
    const { req, res } = createMocks({ method: "GET", query: { id } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("image/svg+xml");
    expect(String(res.getHeader("content-disposition"))).toContain("Fritz");
    expect(String(res.getHeader("content-disposition"))).toContain(".svg");
  });
});

describe("download.png", () => {
  test("forwards to og-image-generator with scale", async () => {
    const id = await makeLabel("Bionade");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
    );
    const handler = await importHandler("../../src/pages/api/labels/[id]/download.png");
    const { req, res } = createMocks({ method: "GET", query: { id, scale: "2" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/png");
    expect(String(res.getHeader("content-disposition"))).toContain("Bionade");
    expect(fetchSpy.mock.calls[0]?.[0] as string).toMatch(/scale=2|width=1260|height=1600/);
  });
});
