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

describe("drafts API", () => {
  test("POST /api/drafts creates a draft and returns id", async () => {
    const handler = await importHandler("../../src/pages/api/drafts/index");
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  test("GET /api/drafts lists drafts", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const get = createMocks({ method: "GET" });
    await indexHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(200);
    const list = get.res._getJSONData();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
  });

  test("PUT /api/drafts/[id] updates config", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id },
      body: {
        name: "test",
        size: "0,33 L",
        price: "1,50 €",
        footerLine1: "",
        footerLine2: "",
        logoId: null,
        colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await idHandler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(200);
    expect(get.res._getJSONData().config.name).toBe("test");
  });

  test("DELETE /api/drafts/[id] removes draft", async () => {
    const indexHandler = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await indexHandler(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/drafts/[id]");
    const del = createMocks({ method: "DELETE", query: { id } });
    await idHandler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(404);
  });
});
