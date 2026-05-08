import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const rand = Math.random().toString(36).slice(2);
  const mod = await import(`${modulePath}?cb=${Date.now()}-${rand}`);
  return mod.default;
}

async function makeDraft() {
  const idx = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await idx(post.req, post.res);
  const id = post.res._getJSONData().id;
  const byId = await importHandler("../../src/pages/api/drafts/[id]");
  const put = createMocks({
    method: "PUT", query: { id },
    body: {
      name: "fritz-kola", size: "0,33 L", price: "2,00 €",
      footerLine1: "Koffein: 25 mg/100 ml", footerLine2: "",
      logoId: null, colors: { background: "#000000", foreground: "#ffffff" },
    },
  });
  await byId(put.req, put.res);
  return id;
}

describe("GET /api/labels/[id]/svg", () => {
  test("returns SVG for a draft", async () => {
    const draftId = await makeDraft();
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({ method: "GET", query: { id: draftId, kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("image/svg+xml");
    expect(res._getData()).toContain("fritz-kola");
  });

  test("rotate=90 returns landscape viewBox", async () => {
    const draftId = await makeDraft();
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({
      method: "GET", query: { id: draftId, kind: "draft", rotate: "90" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toContain('viewBox="0 0 800 630"');
  });

  test("404 for unknown id", async () => {
    const handler = await importHandler("../../src/pages/api/labels/[id]/svg");
    const { req, res } = createMocks({ method: "GET", query: { id: "nope", kind: "draft" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });
});
