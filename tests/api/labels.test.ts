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

async function createDraft(): Promise<string> {
  const handler = await importHandler("../../src/pages/api/drafts/index");
  const { req, res } = createMocks({ method: "POST" });
  await handler(req, res);
  return res._getJSONData().id;
}

describe("labels API", () => {
  test("POST /api/labels promotes a draft", async () => {
    const draftId = await createDraft();
    const handler = await importHandler("../../src/pages/api/labels/index");
    const { req, res } = createMocks({
      method: "POST",
      body: { draftId, name: "Fritz-Kola 0,33L" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(typeof body.id).toBe("string");

    // draft is gone
    const getDraft = await importHandler("../../src/pages/api/drafts/[id]");
    const draftReq = createMocks({ method: "GET", query: { id: draftId } });
    await getDraft(draftReq.req, draftReq.res);
    expect(draftReq.res._getStatusCode()).toBe(404);

    // label exists
    const list = createMocks({ method: "GET" });
    await handler(list.req, list.res);
    expect(list.res._getJSONData()).toHaveLength(1);
  });

  test("PUT /api/labels/[id] updates config", async () => {
    const draftId = await createDraft();
    const promote = await importHandler("../../src/pages/api/labels/index");
    const post = createMocks({ method: "POST", body: { draftId, name: "L" } });
    await promote(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/labels/[id]/index");
    const put = createMocks({
      method: "PUT",
      query: { id },
      body: {
        name: "Renamed",
        config: {
          name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
          logoId: null, colors: { background: "#111111", foreground: "#eeeeee" },
        },
      },
    });
    await idHandler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getJSONData().name).toBe("Renamed");
    expect(get.res._getJSONData().config.colors.background).toBe("#111111");
  });

  test("DELETE /api/labels/[id] removes label", async () => {
    const draftId = await createDraft();
    const promote = await importHandler("../../src/pages/api/labels/index");
    const post = createMocks({ method: "POST", body: { draftId, name: "L" } });
    await promote(post.req, post.res);
    const { id } = post.res._getJSONData();

    const idHandler = await importHandler("../../src/pages/api/labels/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id } });
    await idHandler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const get = createMocks({ method: "GET", query: { id } });
    await idHandler(get.req, get.res);
    expect(get.res._getStatusCode()).toBe(404);
  });
});
