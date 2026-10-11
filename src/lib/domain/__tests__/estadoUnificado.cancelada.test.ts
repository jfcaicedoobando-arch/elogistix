import { describe, expect, it } from "vitest";
import {
  ESTADOS_UNIFICADOS,
  LABEL_ESTADO_UNIFICADO,
  etiquetaEstadoUnificado,
  getEstadoUnificado,
  rankEstadoUnificado,
} from "../estadoUnificado";

describe("estado unificado de proformas canceladas", () => {
  it.each(["pendiente", "aceptada", "rechazada", null, undefined])(
    "prioriza cancelada sobre estado_cliente %s y cualquier vínculo residual",
    (estado_cliente) => {
      for (const factura_id of [null, "factura-historica"]) {
        for (const requiere_autorizacion_proforma of [true, false]) {
          const proforma = {
            estado_proforma: "cancelada",
            estado_cliente,
            factura_id,
            requiere_autorizacion_proforma,
          };
          expect(getEstadoUnificado(proforma)).toBe("cancelada");
          expect(etiquetaEstadoUnificado(proforma)).toBe("Cancelada");
          expect(proforma.factura_id).toBe(factura_id);
          expect(proforma.estado_cliente).toBe(estado_cliente);
        }
      }
    },
  );

  it("ofrece el estado terminal en filtros y lo ordena después de los documentos activos", () => {
    expect(ESTADOS_UNIFICADOS).toContain("cancelada");
    expect(LABEL_ESTADO_UNIFICADO.cancelada).toBe("Cancelada");
    const terminal = rankEstadoUnificado({ estado_proforma: "cancelada" });
    for (const estado_cliente of ["pendiente", "aceptada", "rechazada"]) {
      expect(terminal).toBeGreaterThan(rankEstadoUnificado({ estado_cliente }));
    }
    expect(terminal).toBeGreaterThan(rankEstadoUnificado({ factura_id: "f1" }));
  });

  it("conserva la precedencia de conversión en documentos no cancelados", () => {
    expect(getEstadoUnificado({ estado_proforma: "facturada", estado_cliente: "rechazada" })).toBe("facturada");
    expect(getEstadoUnificado({ estado_proforma: "pendiente", estado_cliente: "rechazada", factura_id: "f1" })).toBe("facturada");
  });
});
