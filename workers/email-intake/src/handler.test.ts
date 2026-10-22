import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildForward, isSupportAddress, toBase64, validRecipient } from "./handler";
import { verify } from "../../../src/lib/inbound/signature";

describe("email-intake worker", () => {
  it("builds a request the app's verifier accepts", async () => {
    const raw = new TextEncoder().encode("From: a@b.c\r\nSubject: Jobs\r\n\r\nHello ✓");
    const { url, init } = await buildForward({ APP_URL: "https://app.example/", INBOUND_SHARED_SECRET: "s3cret" }, "rahim.k7@in.example", raw, null, 1000);
    expect(url).toBe("https://app.example/api/inbound/email");
    const h = init.headers as Record<string, string>;
    expect(await verify("s3cret", h["x-js-timestamp"], h["x-js-signature"], init.body, 1000)).toBe(true);
    expect(await verify("other", h["x-js-timestamp"], h["x-js-signature"], init.body, 1000)).toBe(false);
    const body = JSON.parse(init.body);
    expect(Buffer.from(body.raw, "base64").toString("utf8")).toContain("Hello ✓");
  });
  it("base64-encodes large buffers", () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(toBase64(big)).toBe(Buffer.from(big).toString("base64"));
  });
  it("validates recipients", () => {
    expect(validRecipient("rahim.k7@in.example.com")).toBe(true);
    expect(validRecipient("<script>@x")).toBe(false);
  });
  it("keeps the signature helper identical to the app's", () => {
    const app = readFileSync(new URL("../../../src/lib/inbound/signature.ts", import.meta.url), "utf8");
    const mine = readFileSync(new URL("./signature.ts", import.meta.url), "utf8").split("\n").slice(1).join("\n");
    expect(mine).toBe(app);
  });
  it("sends the public support addresses to a person", () => {
    expect(isSupportAddress("hello@jobpao.app")).toBe(true);
    expect(isSupportAddress(" Support@JobPao.app")).toBe(true);
    expect(isSupportAddress("rahim-7k2q@jobpao.app")).toBe(false);
  });
});
