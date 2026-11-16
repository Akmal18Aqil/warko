import { describe, expect, it } from "vitest";
import type { MenuItem } from "../data/menu";
import { addLine, decreaseLine, removeLine, setLineNote, stockLimitMessage } from "./cart";

const item = (id: string, stock?: number | null): MenuItem => ({
  id,
  barcode: id,
  name: id,
  description: "",
  price: 1000,
  category: "Makanan",
  image: "",
  kind: "Makanan",
  prepMinutes: 1,
  stock,
});

describe("cart lines", () => {
  it("adds a new line then increments it", () => {
    const once = addLine([], "a");
    expect(once).toEqual([{ itemId: "a", qty: 1 }]);
    expect(addLine(once, "a")).toEqual([{ itemId: "a", qty: 2 }]);
  });

  it("drops a line when its quantity reaches zero", () => {
    expect(
      decreaseLine(
        [
          { itemId: "a", qty: 1 },
          { itemId: "b", qty: 2 },
        ],
        "a",
      ),
    ).toEqual([{ itemId: "b", qty: 2 }]);
  });

  it("sets notes and removes lines without touching others", () => {
    const lines = [
      { itemId: "a", qty: 1 },
      { itemId: "b", qty: 1 },
    ];
    expect(setLineNote(lines, "b", "pedas")[1].note).toBe("pedas");
    expect(removeLine(lines, "a")).toEqual([{ itemId: "b", qty: 1 }]);
  });
});

describe("stockLimitMessage", () => {
  it("allows untracked stock and stock with room left", () => {
    expect(stockLimitMessage([], [item("a")], "a")).toBeNull();
    expect(stockLimitMessage([{ itemId: "a", qty: 1 }], [item("a", 2)], "a")).toBeNull();
  });

  it("explains sold-out and last-portions cases", () => {
    expect(stockLimitMessage([], [item("a", 0)], "a")).toBe("a HABIS");
    expect(stockLimitMessage([{ itemId: "a", qty: 2 }], [item("a", 2)], "a")).toBe("Stok a tinggal 2");
  });
});
