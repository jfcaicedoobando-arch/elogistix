/**
 * Estados de embarque excluidos al vincular una factura de proveedor.
 */
import { describe, it, expect } from "vitest";
import {
  ESTADOS_EMBARQUE_NO_VINCULABLES,
  FILTRO_ESTADOS_NO_VINCULABLES,
  esEstadoNoVinculable,
} from "../sugerirEmbarques";

describe("estados de embarque no vinculables", () => {
  it("excluye Cerrado y Cancelado", () => {
    expect([...ESTADOS_EMBARQUE_NO_VINCULABLES]).toEqual(["Cerrado", "Cancelado"]);
    expect(esEstadoNoVinculable("Cerrado")).toBe(true);
    expect(esEstadoNoVinculable("Cancelado")).toBe(true);
  });

  it("permite estados vivos y Entregado / Por liquidar", () => {
    for (const e of ["Confirmado", "En Tránsito", "Llegada", "Por liquidar", "Entregado"]) {
      expect(esEstadoNoVinculable(e)).toBe(false);
    }
  });

  it("trata null e indefinido como vinculables", () => {
    expect(esEstadoNoVinculable(null)).toBe(false);
    expect(esEstadoNoVinculable(undefined)).toBe(false);
  });

  it("arma el filtro PostgREST in (...)", () => {
    expect(FILTRO_ESTADOS_NO_VINCULABLES).toBe("(Cerrado,Cancelado)");
  });
});
