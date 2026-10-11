import { describe, expect, it } from "vitest";
import { resumenProforma } from "@/lib/domain/documentoEstados";

describe("resumenProforma cancelada", () => {
  it.each(["pendiente", "aceptada", "rechazada"] as const)(
    "prioriza la cancelación sobre %s y una conversión histórica",
    (estadoCliente) => {
      for (const requiereAutorizacion of [true, false]) {
        for (const facturaEmitida of [true, false]) {
          const resumen = resumenProforma({
            estadoProforma: "cancelada",
            estadoCliente,
            requiereAutorizacion,
            enviadaAt: "2026-10-01",
            facturada: true,
            facturaEmitida,
            etiquetaConversion: "Convertida a borrador",
          });
          expect(resumen).toMatchObject({
            terminal: true,
            etiquetaTerminal: "Cancelada",
            indiceActual: -1,
            subEtiqueta: null,
          });
        }
      }
    },
  );

  it("marca terminal una cancelada sin respuesta ni factura", () => {
    expect(resumenProforma({
      estadoProforma: "cancelada", estadoCliente: "pendiente", facturada: false,
    }).etiquetaTerminal).toBe("Cancelada");
  });

  it("conserva la respuesta y conversión de documentos vigentes", () => {
    expect(resumenProforma({
      estadoProforma: "pendiente", estadoCliente: "aceptada", facturada: false,
    }).indiceActual).toBe(2);
    expect(resumenProforma({
      estadoProforma: "facturada", estadoCliente: "aceptada", facturada: true,
    }).indiceActual).toBe(3);
  });
});
