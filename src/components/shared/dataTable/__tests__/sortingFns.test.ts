/**
 * Sorting fns: colación es-MX y manejo de null. Extraído de
 * DataTable.regression.test.tsx en 13.85.3.
 */
import { describe, it, expect } from "vitest";
import {
  sortByString,
  sortByNumber,
  sortByDate,
  esCollator,
} from "@/components/shared/dataTable/sortingFns";

describe("sortingFns — colación es-MX y nulls al final", () => {
  interface SR { v: string | null }
  interface NR { n: number | null }
  interface DR { d: string | null }
  const mkS = (v: string | null) =>
    ({ original: { v } } as unknown as import("@tanstack/react-table").Row<SR>);
  const mkN = (n: number | null) =>
    ({ original: { n } } as unknown as import("@tanstack/react-table").Row<NR>);
  const mkD = (d: string | null) =>
    ({ original: { d } } as unknown as import("@tanstack/react-table").Row<DR>);

  it("colación es-MX (acentos y mayúsculas insensibles)", () => {
    expect(esCollator.compare("árbol", "banana")).toBeLessThan(0);
    expect(esCollator.compare("ARBOL", "arbol")).toBe(0);

    const fn = sortByString<SR>((r) => r.v);
    expect(fn(mkS("árbol"), mkS("banana"), "v")).toBeLessThan(0);
    expect(fn(mkS("ARBOL"), mkS("arbol"), "v")).toBe(0);
  });

  it("sortByString manda null/undefined al final", () => {
    const fn = sortByString<SR>((r) => r.v);
    expect(fn(mkS(null), mkS("a"), "v")).toBeGreaterThan(0);
    expect(fn(mkS("a"), mkS(null), "v")).toBeLessThan(0);
    expect(fn(mkS(null), mkS(null), "v")).toBe(0);
  });

  it("sortByNumber respeta nulls al final", () => {
    const fn = sortByNumber<NR>((r) => r.n);
    expect(fn(mkN(10), mkN(null), "n")).toBeLessThan(0);
    expect(fn(mkN(null), mkN(10), "n")).toBeGreaterThan(0);
    expect(fn(mkN(1), mkN(2), "n")).toBeLessThan(0);
  });

  it("sortByDate compara timestamps y trata strings inválidos como nulls", () => {
    const fn = sortByDate<DR>((r) => r.d);
    expect(fn(mkD("2024-01-01"), mkD("2025-01-01"), "d")).toBeLessThan(0);
    expect(fn(mkD("no-es-fecha"), mkD("2024-01-01"), "d")).toBeGreaterThan(0);
  });
});
