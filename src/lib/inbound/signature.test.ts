import { describe, expect, it } from "vitest";
import { sign, verify } from "./signature";

describe("worker -> app signature", () => {
  it("verifies a fresh signature and rejects tampering, wrong secret and replays", async () => {
    const ts = String(Date.now());
    const sig = await sign("s3cret", ts, '{"a":1}');
    expect(await verify("s3cret", ts, sig, '{"a":1}')).toBe(true);
    expect(await verify("s3cret", ts, sig, '{"a":2}')).toBe(false);
    expect(await verify("other", ts, sig, '{"a":1}')).toBe(false);
    expect(await verify("s3cret", ts, sig, '{"a":1}', Date.now() + 10 * 60 * 1000)).toBe(false);
  });
});
