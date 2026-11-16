import { describe, expect, it } from "vitest";
import { HttpError, Reader } from "../src/http";

function errorsOf(run: (r: Reader) => void, body: Record<string, unknown>, strict = false): Record<string, string[]> {
  const r = new Reader(body, { strict });
  run(r);
  try {
    r.done();
  } catch (error) {
    if (error instanceof HttpError && error.errors) return error.errors;
    throw error;
  }
  return {};
}

describe("Reader", () => {
  it("collects every field error instead of stopping at the first", () => {
    const errors = errorsOf(
      (r) => {
        r.string("name", { max: 3 });
        r.integer("qty", { min: 1 });
        r.oneOf("kind", ["a", "b"] as const);
      },
      { name: "toolong", qty: 0, kind: "z" },
    );
    expect(Object.keys(errors).sort()).toEqual(["kind", "name", "qty"]);
  });

  it("normalizes and validates strings in one place", () => {
    const options = { max: 20, normalize: (v: string) => v.trim().toLowerCase(), pattern: /^[a-z]+$/, patternMessage: "huruf saja" };
    const r = new Reader({ ok: "  Sari ", bad: "Sari 2" });
    expect(r.string("ok", options)).toBe("sari");
    expect(r.string("bad", options)).toBeUndefined();
    expect(() => r.done()).toThrow(HttpError);
  });

  it("rejects blank text when nonBlank is set", () => {
    expect(errorsOf((r) => r.string("name", { max: 10, nonBlank: true }), { name: "   " }).name).toBeDefined();
  });

  it("reports nested errors under their path", () => {
    const errors = errorsOf(
      (r) => r.array("items", { min: 1, max: 3 }).forEach((entry, i) => r.child(entry, `items.${i}`).integer("qty", { min: 1 })),
      { items: [{ qty: 1 }, { qty: 0 }] },
    );
    expect(Object.keys(errors)).toEqual(["items.1.qty"]);
  });

  it("only reports unknown keys when strict", () => {
    const read = (r: Reader) => r.integer("a");
    expect(errorsOf(read, { a: 1, extra: true })).toEqual({});
    expect(Object.keys(errorsOf(read, { a: 1, extra: true }, true))).toEqual(["extra"]);
  });
});
