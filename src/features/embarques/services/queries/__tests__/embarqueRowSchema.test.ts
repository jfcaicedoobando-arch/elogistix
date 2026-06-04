import { describe, it, expect } from "vitest";
import { embarqueListRowSchema, embarqueListRowsSchema } from "../embarqueRowSchema";

describe("embarqueListRowSchema", () => {
  it("valida una fila típica del listado", () => {
    const row = {
      id: "uuid-1",
      expediente: "EXP-0001",
      cliente_id: "cli-1",
      cliente_nombre: "Acme",
      modo: "Marítimo",
      estado: "Confirmado",
      etd: "2026-05-01",
      eta: "2026-06-01",
      operador: "Juan",
      tipo: "Importación",
      created_at: "2026-04-01T00:00:00Z",
      tipo_cambio_usd: 17.5,
      tipo_cambio_eur: 19.2,
      tiene_proforma: true,
      // Campo extra: debe permitirse vía passthrough
      bl_master: "MAEU123",
    };
    const parsed = embarqueListRowSchema.parse(row);
    expect(parsed.id).toBe("uuid-1");
    expect((parsed as unknown as { bl_master: string }).bl_master).toBe("MAEU123");
  });

  it("rechaza filas que pierden el id", () => {
    const bad = { expediente: "EXP", modo: "Marítimo", created_at: "x" };
    expect(() => embarqueListRowSchema.parse(bad)).toThrow();
  });

  it("valida arrays vacíos", () => {
    expect(embarqueListRowsSchema.parse([])).toEqual([]);
  });
});
