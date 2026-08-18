import { describe, it, expect } from "vitest";
import {
  agruparPorContenedor,
  filtrarPorContenedor,
} from "../conceptosPorContenedor";

const mkC = (id: string, contenedor_id: string | null) => ({ id, contenedor_id });

describe("agruparPorContenedor", () => {
  it("happy path: assigns concepts to their container", () => {
    const conceptos = [mkC("c1", "box1"), mkC("c2", "box2"), mkC("c3", null)];
    const result = agruparPorContenedor(conceptos, ["box1", "box2"]);
    expect(result.porContenedor["box1"]).toEqual([mkC("c1", "box1")]);
    expect(result.porContenedor["box2"]).toEqual([mkC("c2", "box2")]);
    expect(result.generales).toEqual([mkC("c3", null)]);
  });

  it("empty input yields empty maps", () => {
    const result = agruparPorContenedor([], ["box1"]);
    expect(result.porContenedor["box1"]).toEqual([]);
    expect(result.generales).toEqual([]);
  });

  it("concept referencing unknown container goes to generales", () => {
    const conceptos = [mkC("c1", "deleted-box")];
    const result = agruparPorContenedor(conceptos, ["box1"]);
    expect(result.porContenedor["box1"]).toEqual([]);
    expect(result.generales).toEqual([mkC("c1", "deleted-box")]);
  });

  it("no container ids → all go to generales", () => {
    const conceptos = [mkC("c1", "box1"), mkC("c2", null)];
    const result = agruparPorContenedor(conceptos, []);
    expect(result.generales).toHaveLength(2);
  });
});

describe("filtrarPorContenedor", () => {
  const conceptos = [
    mkC("c1", "box1"),
    mkC("c2", null),
    mkC("c3", "box2"),
  ];

  it("todos returns all", () => {
    expect(filtrarPorContenedor(conceptos, "todos")).toHaveLength(3);
  });

  it("generales returns only those without container", () => {
    expect(filtrarPorContenedor(conceptos, "generales")).toEqual([mkC("c2", null)]);
  });

  it("specific uuid returns matching + generales", () => {
    const result = filtrarPorContenedor(conceptos, "box1");
    expect(result).toEqual([mkC("c1", "box1"), mkC("c2", null)]);
  });

  it("empty input always returns empty", () => {
    expect(filtrarPorContenedor([], "todos")).toEqual([]);
    expect(filtrarPorContenedor([], "box1")).toEqual([]);
  });
});
