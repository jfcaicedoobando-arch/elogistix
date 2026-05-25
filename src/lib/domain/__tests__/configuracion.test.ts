import { describe, it, expect } from "vitest";
import { agruparConfigPorCategoria } from "@/lib/domain/configuracion";

describe("agruparConfigPorCategoria", () => {
  it("agrupa items por categoría manteniendo orden", () => {
    const items = [
      { categoria: "general", key: "a" },
      { categoria: "fiscal", key: "b" },
      { categoria: "general", key: "c" },
    ];
    const out = agruparConfigPorCategoria(items);
    expect(out.general.map((i) => i.key)).toEqual(["a", "c"]);
    expect(out.fiscal.map((i) => i.key)).toEqual(["b"]);
  });

  it("retorna objeto vacío con lista vacía", () => {
    expect(agruparConfigPorCategoria([])).toEqual({});
  });

  it("crea una sola clave cuando todos los items comparten categoría", () => {
    const out = agruparConfigPorCategoria([{ categoria: "x" }, { categoria: "x" }]);
    expect(Object.keys(out)).toEqual(["x"]);
    expect(out.x).toHaveLength(2);
  });
});
