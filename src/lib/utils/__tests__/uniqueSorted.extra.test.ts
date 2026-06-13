import { describe, it, expect } from "vitest";
import { uniqueSorted } from "@/lib/utils/uniqueSorted";

describe("uniqueSorted | uniqueSorted extra", () => {
  it("01 — retorna arreglo vacío para entrada vacía", () => {
    expect(uniqueSorted([] as string[], (x) => x)).toEqual([]);
  });
  it("02 — un único elemento cuando todos son iguales", () => {
    expect(uniqueSorted(["a", "a", "a"], (x) => x)).toEqual(["a"]);
  });
  it("03 — elimina duplicados y ordena", () => {
    expect(uniqueSorted(["banana", "apple", "apple", "cherry"], (x) => x)).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });
  it("04 — filtra null del selector", () => {
    const items: Array<{ v: string | null }> = [{ v: "a" }, { v: null }, { v: "b" }];
    expect(uniqueSorted(items, (x) => x.v)).toEqual(["a", "b"]);
  });
  it("05 — filtra undefined del selector", () => {
    const items: Array<{ v: string | undefined }> = [{ v: "a" }, { v: undefined }, { v: "b" }];
    expect(uniqueSorted(items, (x) => x.v)).toEqual(["a", "b"]);
  });
  it("06 — filtra strings vacíos", () => {
    expect(uniqueSorted([{ v: "a" }, { v: "" }, { v: "b" }], (x) => x.v)).toEqual(["a", "b"]);
  });
  it("07 — acepta arreglo readonly", () => {
    const arr = ["c", "a", "b"] as const;
    expect(uniqueSorted(arr, (x) => x)).toEqual(["a", "b", "c"]);
  });
  it("08 — funciona con selector de propiedad", () => {
    const data = [{ ciudad: "Guadalajara" }, { ciudad: "CDMX" }, { ciudad: "Guadalajara" }];
    expect(uniqueSorted(data, (x) => x.ciudad)).toEqual(["CDMX", "Guadalajara"]);
  });
  it("09 — un único elemento", () => {
    expect(uniqueSorted([{ k: "solo" }], (x) => x.k)).toEqual(["solo"]);
  });
  it("10 — no muta el arreglo original", () => {
    const original = ["b", "a", "c"];
    uniqueSorted(original, (x) => x);
    expect(original).toEqual(["b", "a", "c"]);
  });
});
