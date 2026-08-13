import { describe, expect, it } from "vitest";
import {
  bloqueoPaso,
  tieneRepVivo,
  type ContextoPasos,
  type PagoRefacturacion,
} from "../refacturacionPasos";

function pago(status: string | null, canceladoEn: string | null = null): PagoRefacturacion {
  return {
    id: "p-1",
    fecha_pago: "2026-08-12",
    monto: 95_120,
    moneda: "MXN",
    monto_aplicado_factura: 95_120,
    uuid_rep: "F4FC33D7",
    estado_rep: canceladoEn ? "Cancelado" : "Timbrado",
    rep_cancelado_en: canceladoEn,
    rep_cancellation_status: status,
  };
}

function contexto(pagos: PagoRefacturacion[]): ContextoPasos {
  return {
    casoAbierto: true,
    clienteDestinoId: "cliente-2",
    motivo: "Pago desde otra razón social",
    pagos,
    facturaNueva: null,
    original: null,
    pagoSeleccionadoId: null,
    pagoYaReasignado: false,
  };
}

describe("estado asíncrono del REP en refacturación", () => {
  it.each(["pending", "verifying"])("mantiene bloqueado el paso para %s", (status) => {
    expect(bloqueoPaso(2, contexto([pago(status)]))).toContain("en verificación");
  });

  it.each(["rejected", "expired"])("permite reintentar después de %s", (status) => {
    expect(bloqueoPaso(2, contexto([pago(status)]))).toContain("Cancela el complemento");
  });

  it("libera el paso únicamente cuando existe confirmación de cancelación", () => {
    const cancelado = pago("accepted", "2026-08-13T22:30:00Z");
    expect(tieneRepVivo(cancelado)).toBe(false);
    expect(bloqueoPaso(2, contexto([cancelado]))).toBeNull();
  });
});