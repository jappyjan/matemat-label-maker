import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createMocks } from "node-mocks-http";
import { Readable } from "node:stream";
import { setupApiEnv, type ApiTestEnv } from "../helpers/api";

let env: ApiTestEnv;
beforeEach(() => { env = setupApiEnv(); });
afterEach(() => { env.cleanup(); });

async function importHandler(modulePath: string) {
  const rand = Math.random().toString(36).slice(2);
  const mod = await import(`${modulePath}?cb=${Date.now()}-${rand}`);
  return mod.default;
}

// Build a multipart Readable that formidable can parse (matches the helper used in C4 tests).
function multipartReq(filename: string, contentType: string, contents: Buffer) {
  const boundary = "----test";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head), contents, Buffer.from(tail)]);
  const stream = Readable.from(body) as Readable & { method: string; headers: Record<string, string> };
  stream.method = "POST";
  stream.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(body.length),
  };
  const { res } = createMocks({ method: "POST" });
  return { req: stream as never, res };
}

async function uploadOne(): Promise<string> {
  const handler = await importHandler("../../src/pages/api/logos/index");
  const { req, res } = multipartReq("x.svg", "image/svg+xml", Buffer.from("<svg/>"));
  await handler(req, res);
  return res._getJSONData().id;
}

describe("logo file + rename + delete", () => {
  test("GET /api/logos/[id]/file returns the bytes", async () => {
    const id = await uploadOne();
    const handler = await importHandler("../../src/pages/api/logos/[id]/file");
    const { req, res } = createMocks({ method: "GET", query: { id } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("content-type")).toBe("image/svg+xml");
    expect(res._getData()).toBe("<svg/>");
  });

  test("PUT /api/logos/[id] renames", async () => {
    const id = await uploadOne();
    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const put = createMocks({ method: "PUT", query: { id }, body: { filename: "renamed.svg" } });
    await handler(put.req, put.res);
    expect(put.res._getStatusCode()).toBe(200);

    const list = await importHandler("../../src/pages/api/logos/index");
    const get = createMocks({ method: "GET" });
    await list(get.req, get.res);
    expect(get.res._getJSONData()[0].filename).toBe("renamed.svg");
  });

  test("DELETE refuses if logo is used by a label", async () => {
    const id = await uploadOne();

    // Build a draft using this logo, then promote to a label.
    const drafts = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await drafts(post.req, post.res);
    const draftId = post.res._getJSONData().id;
    const draftId2 = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id: draftId },
      body: {
        name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
        logoId: id, colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await draftId2(put.req, put.res);

    const promote = await importHandler("../../src/pages/api/labels/index");
    const promoteReq = createMocks({ method: "POST", body: { draftId, name: "x" } });
    await promote(promoteReq.req, promoteReq.res);

    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id } });
    await handler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(409);
  });

  test("DELETE with ?force=true clears logoId on labels and removes logo", async () => {
    const id = await uploadOne();

    const drafts = await importHandler("../../src/pages/api/drafts/index");
    const post = createMocks({ method: "POST" });
    await drafts(post.req, post.res);
    const draftId = post.res._getJSONData().id;
    const draftId2 = await importHandler("../../src/pages/api/drafts/[id]");
    const put = createMocks({
      method: "PUT",
      query: { id: draftId },
      body: {
        name: "x", size: "", price: "", footerLine1: "", footerLine2: "",
        logoId: id, colors: { background: "#000000", foreground: "#ffffff" },
      },
    });
    await draftId2(put.req, put.res);
    const promote = await importHandler("../../src/pages/api/labels/index");
    const promoteReq = createMocks({ method: "POST", body: { draftId, name: "x" } });
    await promote(promoteReq.req, promoteReq.res);
    const labelId = promoteReq.res._getJSONData().id;

    const handler = await importHandler("../../src/pages/api/logos/[id]/index");
    const del = createMocks({ method: "DELETE", query: { id, force: "true" } });
    await handler(del.req, del.res);
    expect(del.res._getStatusCode()).toBe(200);

    const labelById = await importHandler("../../src/pages/api/labels/[id]/index");
    const get = createMocks({ method: "GET", query: { id: labelId } });
    await labelById(get.req, get.res);
    expect(get.res._getJSONData().config.logoId).toBeNull();
  });
});
