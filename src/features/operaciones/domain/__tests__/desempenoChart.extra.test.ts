import { describe, it, expect } from "vitest";
import {
  shortNameFromEmail,
  buildDesempenoChartRows,
  ESTADOS_KEYS,
} from "@/features/operaciones/domain/desempenoChart";
import type { OperadorBase } from "@/types/operaciones";

const makeOp = (nombre: string, overrides: Partial<OperadorBase["desgloseEstados"]> = {}): OperadorBase => ({
  nombre,
  desgloseEstados: {
    Confirmado: 0,
    "En Tránsito": 0,
    Llegada: 0,
    "En Proceso": 0,
    Cerrado: 0,
    ...overrides,
  },
});

describe("desempenoChart | shortNameFromEmail", () => {
  it("convierte email estándar a nombre capitalizado", () => {
    expect(shortNameFromEmail("alan.hernandez@elogistixshipping.com")).toBe("Alan Hernandez");
  });

  it("maneja guiones bajos como separadores", () => {
    expect(shortNameFromEmail("juan_carlos@ejemplo.com")).toBe("Juan Carlos");
  });

  it("maneja guiones como separadores", () => {
    expect(shortNameFromEmail("maria-jose@empresa.com")).toBe("Maria Jose");
  });

  it("retorna '—' cuando el string está vacío", () => {
    expect(shortNameFromEmail("")).toBe("—");
  });

  it("retorna el nombre capitalizado cuando no hay @", () => {
    expect(shortNameFromEmail("pedro.gomez")).toBe("Pedro Gomez");
  });

  it("capitaliza correctamente un nombre en mayúsculas", () => {
    expect(shortNameFromEmail("LUIS.PEREZ@test.com")).toBe("Luis Perez");
  });

  it("maneja un solo segmento sin separadores", () => {
    expect(shortNameFromEmail("admin@empresa.com")).toBe("Admin");
  });

  it("elimina segmentos vacíos generados por separadores consecutivos", () => {
    const result = shortNameFromEmail("a..b@test.com");
    expect(result).toBe("A B");
  });
});

describe("desempenoChart | buildDesempenoChartRows", () => {
  it("retorna array vacío cuando no hay operadores", () => {
    expect(buildDesempenoChartRows([])).toEqual([]);
  });

  it("construye una fila por operador", () => {
    const ops = [makeOp("a@b.com"), makeOp("c@d.com")];
    expect(buildDesempenoChartRows(ops)).toHaveLength(2);
  });

  it("mapea correctamente los conteos de estados", () => {
    const op = makeOp("user@empresa.com", { Confirmado: 3, "En Tránsito": 7, Llegada: 2, "En Proceso": 1, Cerrado: 5 });
    const [row] = buildDesempenoChartRows([op]);
    expect(row.Confirmado).toBe(3);
    expect(row["En Tránsito"]).toBe(7);
    expect(row.Llegada).toBe(2);
    expect(row["En Proceso"]).toBe(1);
    expect(row.Cerrado).toBe(5);
  });

  it("asigna el nombre transformado desde el email", () => {
    const [row] = buildDesempenoChartRows([makeOp("pedro.ramirez@empresa.com")]);
    expect(row.nombre).toBe("Pedro Ramirez");
  });

  it("preserva el orden de los operadores", () => {
    const ops = [makeOp("a@x.com"), makeOp("b@x.com"), makeOp("c@x.com")];
    const rows = buildDesempenoChartRows(ops);
    expect(rows.map((r) => r.nombre)).toEqual(["A", "B", "C"]);
  });

  it("el objeto resultado contiene exactamente las claves de ChartRow", () => {
    const [row] = buildDesempenoChartRows([makeOp("x@y.com")]);
    expect(row).toHaveProperty("nombre");
    expect(row).toHaveProperty("Confirmado");
    expect(row).toHaveProperty("En Tránsito");
    expect(row).toHaveProperty("Llegada");
    expect(row).toHaveProperty("En Proceso");
    expect(row).toHaveProperty("Cerrado");
  });
});

describe("desempenoChart | ESTADOS_KEYS", () => {
  it("contiene exactamente 5 estados", () => {
    expect(ESTADOS_KEYS).toHaveLength(5);
  });

  it("incluye todos los estados esperados", () => {
    expect(ESTADOS_KEYS).toContain("Confirmado");
    expect(ESTADOS_KEYS).toContain("En Tránsito");
    expect(ESTADOS_KEYS).toContain("Llegada");
    expect(ESTADOS_KEYS).toContain("En Proceso");
    expect(ESTADOS_KEYS).toContain("Cerrado");
  });
});
