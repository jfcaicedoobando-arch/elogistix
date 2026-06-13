/**
 * genericPayloadMapper.extra — edge cases no cubiertos en genericPayloadMapper.test.ts.
 */
import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { createPayloadMapper, F } from "@/lib/mappers/genericPayloadMapper";

interface SimpleForm { name: string; count: string; tag: string }
interface SimpleRow  { name: string; count: number; tag: string | null }

const simpleMapper = createPayloadMapper<SimpleForm, SimpleRow>({
  fields: [
    F.raw<SimpleForm, SimpleRow>()("name", "name"),
    F.num<SimpleForm, SimpleRow>()("count", "count"),
    F.emptyNull<SimpleForm, SimpleRow>()("tag", "tag"),
  ],
});

describe("genericPayloadMapper.extra — F.raw", () => {
  it("[GPM-01] F.raw copia el valor sin transformación en toDb", () => {
    const row = simpleMapper.toDb({ name: "hello", count: "3", tag: "x" });
    expect(row.name).toBe("hello");
  });

  it("[GPM-02] F.raw copia el valor sin transformación en fromDb", () => {
    const form = simpleMapper.fromDb({ name: "world", count: 7, tag: null });
    expect(form.name).toBe("world");
  });
});

describe("genericPayloadMapper.extra — F.str default custom", () => {
  interface F2 { mode: string }
  interface R2 { mode: string }
  const m = createPayloadMapper<F2, R2>({ fields: [F.str<F2, R2>("N/A")("mode", "mode")] });

  it("[GPM-03] F.str(default) usa el default cuando el valor es null", () => {
    const row = m.toDb({ mode: null as unknown as string });
    expect(row.mode).toBe("N/A");
  });

  it("[GPM-04] F.str(default) usa el default en fromDb cuando el valor es undefined", () => {
    const form = m.fromDb({ mode: undefined as unknown as string });
    expect(form.mode).toBe("N/A");
  });
});

describe("genericPayloadMapper.extra — F.num edge cases", () => {
  it("[GPM-05] F.num convierte null a 0 en toDb", () => {
    const row = simpleMapper.toDb({ name: "a", count: null as unknown as string, tag: "" });
    expect(row.count).toBe(0);
  });

  it("[GPM-06] F.num convierte null a string vacío en fromDb", () => {
    const form = simpleMapper.fromDb({ name: "a", count: null as unknown as number, tag: null });
    expect(form.count).toBe("");
  });

  it("[GPM-07] F.num con string 'abc' (NaN) devuelve default 0", () => {
    const row = simpleMapper.toDb({ name: "a", count: "abc", tag: "" });
    expect(row.count).toBe(0);
  });
});

describe("genericPayloadMapper.extra — F.emptyNull", () => {
  it("[GPM-08] F.emptyNull preserva string no vacío en toDb", () => {
    const row = simpleMapper.toDb({ name: "x", count: "1", tag: "BL-001" });
    expect(row.tag).toBe("BL-001");
  });

  it("[GPM-09] F.emptyNull convierte null de BD a string vacío en fromDb", () => {
    const form = simpleMapper.fromDb({ name: "x", count: 0, tag: null });
    expect(form.tag).toBe("");
  });
});

describe("genericPayloadMapper.extra — computedFromDb", () => {
  interface FComp { label: string; derived: string }
  interface RComp { label: string; meta: boolean }

  const m = createPayloadMapper<FComp, RComp>({
    fields: [F.raw<FComp, RComp>()("label", "label")],
    computedFromDb: (_row, partial) => ({ ...partial, derived: "computed" }),
  });

  it("[GPM-10] computedFromDb añade campo derivado al form", () => {
    const form = m.fromDb({ label: "test", meta: true });
    expect(form.derived).toBe("computed");
    expect(form.label).toBe("test");
  });
});
