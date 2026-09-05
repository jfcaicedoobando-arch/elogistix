/**
 * Regresión (auditoría v13.823.143 · bug 2): una proforma con factura vinculada
 * cuenta como facturada aunque `estado_proforma` no se haya sincronizado.
 */
import { describe, it, expect } from "vitest";
import { getEstadoUnificado } from "@/lib/domain/estadoUnificado";

describe("getEstadoUnificado · factura vinculada", () => {
  it("con factura_id devuelve facturada aunque el estado_cliente sea aceptada", () => {
    expect(
      getEstadoUnificado({ estado_proforma: "aprobada", estado_cliente: "aceptada", factura_id: "f1" }),
    ).toBe("facturada");
  });

  it("sin factura_id mantiene el estado del cliente", () => {
    expect(
      getEstadoUnificado({ estado_proforma: "aprobada", estado_cliente: "aceptada", factura_id: null }),
    ).toBe("aceptada");
  });
});
