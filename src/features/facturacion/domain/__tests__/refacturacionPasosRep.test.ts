import { describe, expect, it } from "vitest";
import {
  avisoPaso,
  bloqueoPaso,
  repsEnVerificacion,
  tieneRepVivo,
  type ContextoPasos,
  type FacturaRefacturacion,
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

const facturaTimbrada: FacturaRefacturacion = {
  id: "f-nueva",
  numero: "F1026-RF",
  estado: "Emitida",
  uuid_fiscal: "ABC",
};

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
  it.each(["pending", "verifying"])(
    "permite adelantar la factura del nuevo receptor con estado %s",
    (status) => {
      const ctx = contexto([pago(status)]);
      expect(bloqueoPaso(2, ctx)).toBeNull();
      expect(avisoPaso(2, ctx)).toContain("verificación");
      expect(repsEnVerificacion(ctx.pagos)).toHaveLength(1);
    },
  );

  it("bloquea el paso 2 cuando el REP vivo no tiene solicitud de cancelación", () => {
    expect(bloqueoPaso(2, contexto([pago(null)]))).toContain("Cancela el complemento");
  });

  it.each(["rejected", "expired"])("permite reintentar después de %s", (status) => {
    expect(bloqueoPaso(2, contexto([pago(status)]))).toContain("Cancela el complemento");
  });

  it("libera el paso únicamente cuando existe confirmación de cancelación", () => {
    const cancelado = pago("accepted", "2026-08-13T22:30:00Z");
    expect(tieneRepVivo(cancelado)).toBe(false);
    expect(bloqueoPaso(2, contexto([cancelado]))).toBeNull();
    expect(avisoPaso(2, contexto([cancelado]))).toBeNull();
  });

  it("mantiene bloqueada la reasignación del pago mientras el REP siga vigente", () => {
    const ctx: ContextoPasos = {
      ...contexto([pago("verifying")]),
      facturaNueva: facturaTimbrada,
      pagoSeleccionadoId: "p-1",
    };
    expect(bloqueoPaso(5, ctx)).toContain("dos veces");
  });

  it("permite reasignar cuando el REP quedó cancelado", () => {
    const ctx: ContextoPasos = {
      ...contexto([pago("accepted", "2026-08-13T22:30:00Z")]),
      facturaNueva: facturaTimbrada,
      pagoSeleccionadoId: "p-1",
      ordenanteNombre: undefined,
    } as ContextoPasos;
    expect(bloqueoPaso(5, ctx)).toBeNull();
  });
});
