import { describe, expect, it } from "vitest";
import {
  etiquetaEstadoUnificado,
  LABEL_ESTADO_UNIFICADO,
} from "../estadoUnificado";

describe("etiquetaEstadoUnificado", () => {
  it("distingue estados internos de los que esperan respuesta del cliente", () => {
    expect(
      etiquetaEstadoUnificado({
        estado_cliente: "pendiente",
        requiere_autorizacion_proforma: false,
      }),
    ).toBe("Pendiente aprobación interna");

    expect(
      etiquetaEstadoUnificado({
        estado_cliente: "aceptada",
        requiere_autorizacion_proforma: false,
      }),
    ).toBe("Aprobada internamente");
  });

  it("conserva las etiquetas específicas del flujo externo", () => {
    expect(
      etiquetaEstadoUnificado({
        estado_cliente: "pendiente",
        requiere_autorizacion_proforma: true,
      }),
    ).toBe("Pendiente cliente");
    expect(
      etiquetaEstadoUnificado({
        estado_cliente: "aceptada",
        requiere_autorizacion_proforma: true,
      }),
    ).toBe("Aceptada");
  });

  it("usa categorías neutrales en filtros que mezclan ambos flujos", () => {
    expect(LABEL_ESTADO_UNIFICADO.pendiente).toBe("Pendiente");
    expect(LABEL_ESTADO_UNIFICADO.aceptada).toBe("Aprobada");
  });
});
