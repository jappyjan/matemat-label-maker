import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import JSZip from "jszip";
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

async function makeLabel(name: string) {
  const drafts = await importHandler("../../src/pages/api/drafts/index");
  const post = createMocks({ method: "POST" });
  await drafts(post.req, post.res);
  const draftId = post.res._getJSONData().id;
  const promote = await importHandler("../../src/pages/api/labels/index");
  const promoted = createMocks({ method: "POST", body: { draftId, name } });
  await promote(promoted.req, promoted.res);
  return promoted.res._getJSONData().id;
}

describe("batch-download", () => {
  test("returns a zip with svg files", async () => {
    const a = await makeLabel("Coke");
    const b = await makeLabel("Bionade");
    const handler = await importHandler("../../src/pages/api/labels/batch-download");
    const { req, res } = createMocks({
      method: "GET", query: { ids: `${a},${b}`, format: "svg" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toContain("application/zip");
    const buf = res._getData() as Buffer;
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.includes("Coke"))).toBe(true);
    expect(names.some((n) => n.includes("Bionade"))).toBe(true);
  });

  test("returns 404 when no ids resolve", async () => {
    const handler = await importHandler("../../src/pages/api/labels/batch-download");
    const { req, res } = createMocks({
      method: "GET", query: { ids: "no1,no2", format: "svg" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });
});
