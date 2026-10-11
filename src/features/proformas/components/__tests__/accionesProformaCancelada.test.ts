import { describe, expect, it } from "vitest";
import { computarFlags } from "../accionesProformaFlags";
import type { ProformaDetalleFull } from "../../services";

describe("histórico de proformas canceladas", () => {
  it.each(["pendiente", "aceptada", "rechazada"])("no permite actuar con respuesta %s", (estado_cliente) => {
    const p = { estado_proforma: "cancelada", estado_cliente, factura_id: null } as ProformaDetalleFull;
    const flags = computarFlags(p, true, true);
    expect(flags.puedeConvertir).toBe(false);
    expect(flags.puedeResponder).toBe(false);
    expect(flags.mostrarHint).toBe(false);
  });

  it("conserva la conversión de una nueva proforma aceptada y los permisos", () => {
    const p = { estado_proforma: "pendiente", estado_cliente: "aceptada", factura_id: null } as ProformaDetalleFull;
    expect(computarFlags(p, true, true).puedeConvertir).toBe(true);
    expect(computarFlags(p, false, true).puedeConvertir).toBe(false);
  });
});
