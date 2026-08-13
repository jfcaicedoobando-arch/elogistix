import { describe, expect, it } from "vitest";
import { mapearEventos } from "../refacturacionEventos";
import type { RefacturacionEventoRaw } from "@/features/facturacion/services/refacturacionExpediente";

function raw(over: Partial<RefacturacionEventoRaw>): RefacturacionEventoRaw {
  return {
    id: "1", ts: "2026-08-13T10:00:00Z", accion: "refacturacion_abierta",
    usuario_email: "ana@empresa.mx", entidad_nombre: "F-001", detalles: {},
    ...over,
  };
}

describe("mapearEventos", () => {
  it("ordena del más antiguo al más reciente", () => {
    const res = mapearEventos([
      raw({ id: "b", ts: "2026-08-13T12:00:00Z", accion: "facturapi_emitida" }),
      raw({ id: "a", ts: "2026-08-13T09:00:00Z" }),
    ]);
    expect(res.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("traduce la acción y asigna el paso correspondiente", () => {
    const [e] = mapearEventos([raw({ accion: "refacturacion_pago_reasignado" })]);
    expect(e.titulo).toBe("Pago reasignado a la nueva factura");
    expect(e.paso).toBe(5);
    expect(e.severidad).toBe("ok");
  });

  it("marca los fallos como error y los trámites SAT como pendientes", () => {
    const res = mapearEventos([
      raw({ id: "x", accion: "facturapi_rep_cancelar_failed" }),
      raw({ id: "y", accion: "facturapi_cancelacion_solicitada" }),
    ]);
    expect(res.find((e) => e.id === "x")?.severidad).toBe("error");
    expect(res.find((e) => e.id === "y")?.severidad).toBe("pendiente");
  });

  it("usa 'Sistema' cuando no hay usuario y humaniza acciones desconocidas", () => {
    const [e] = mapearEventos([raw({ accion: "algo.raro_paso", usuario_email: "" })]);
    expect(e.usuarioEmail).toBe("Sistema");
    expect(e.titulo).toBe("Algo raro paso");
  });
});
