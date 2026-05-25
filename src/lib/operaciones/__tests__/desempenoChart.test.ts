import { describe, it, expect } from "vitest";
import { shortNameFromEmail, buildDesempenoChartRows, ESTADOS_KEYS } from "@/lib/operaciones/desempenoChart";
import type { OperadorBase } from "@/types/operaciones";

describe("shortNameFromEmail", () => {
  it("convierte email punto-separado a Title Case", () => {
    expect(shortNameFromEmail("alan.hernandez@elogistixshipping.com")).toBe("Alan Hernandez");
  });
  it("acepta separadores _ y -", () => {
    expect(shortNameFromEmail("maria_jose-lopez@x.com")).toBe("Maria Jose Lopez");
  });
  it("retorna — para vacío", () => {
    expect(shortNameFromEmail("")).toBe("—");
  });
  it("respeta nombre ya sin email", () => {
    expect(shortNameFromEmail("juan")).toBe("Juan");
  });
  it("filtra segmentos vacíos por separadores repetidos", () => {
    expect(shortNameFromEmail("a..b@x.com")).toBe("A B");
  });
});

describe("buildDesempenoChartRows", () => {
  it("mapea operadores a filas con todas las claves de estado", () => {
    const ops: OperadorBase[] = [{
      nombre: "ana.gomez@x.com",
      desgloseEstados: { Confirmado: 3, "En Tránsito": 1, Llegada: 0, "En Proceso": 2, Cerrado: 5 },
    }];
    const rows = buildDesempenoChartRows(ops);
    expect(rows).toHaveLength(1);
    expect(rows[0].nombre).toBe("Ana Gomez");
    for (const k of ESTADOS_KEYS) expect(rows[0]).toHaveProperty(k);
    expect(rows[0].Confirmado).toBe(3);
    expect(rows[0].Cerrado).toBe(5);
  });
  it("retorna [] para lista vacía", () => {
    expect(buildDesempenoChartRows([])).toEqual([]);
  });
});
