import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Readable } from "node:stream";
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

// formidable expects a real readable stream; we create one and attach HTTP-like
// properties so formidable can detect the content-type and parse the multipart body.
function multipartReq(filename: string, contentType: string, contents: Buffer) {
  const boundary = "----test";
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(head), contents, Buffer.from(tail)]);
  const { res } = createMocks({
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
  });
  // node-mocks-http's req is an EventEmitter, not a Readable — formidable needs
  // a real Readable stream. Build one and attach the HTTP properties formidable
  // reads (method, headers).
  const req = new Readable({ read() {} }) as Readable & {
    method: string;
    headers: Record<string, string>;
  };
  req.method = "POST";
  req.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(body.length),
  };
  req.push(body);
  req.push(null);
  return { req, res };
}

describe("POST /api/logos", () => {
  test("uploads an SVG and marks it recolorable", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="black" /></svg>');
    const { req, res } = multipartReq("logo.svg", "image/svg+xml", svg);
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(body.recolorable).toBe(true);
    expect(body.mimeType).toBe("image/svg+xml");
    expect(body.filename).toBe("logo.svg");
  });

  test("rejects unsupported mime types", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const { req, res } = multipartReq("logo.gif", "image/gif", Buffer.from("GIF89a"));
    await handler(req, res);
    expect(res._getStatusCode()).toBe(415);
  });

  test("rejects uploads larger than the size limit", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const big = Buffer.alloc(11 * 1024 * 1024, 0xff);
    const { req, res } = multipartReq("big.svg", "image/svg+xml", big);
    await handler(req, res);
    expect(res._getStatusCode()).toBe(413);
  });

  test("GET /api/logos lists uploaded logos", async () => {
    const handler = await importHandler("../../src/pages/api/logos/index");
    const { req: postReq, res: postRes } = multipartReq("logo.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await handler(postReq, postRes);
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toHaveLength(1);
  });
});
