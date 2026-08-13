import { describe, expect, it } from "vitest";
import {
  avisoPaso,
  bloqueoPaso,
  cancelacionOriginalEnTramite,
  cancelacionOriginalRechazada,
  type ContextoPasos,
  type FacturaRefacturacion,
} from "../refacturacionPasos";

function original(estado: string, cancellation: string | null): FacturaRefacturacion {
  return { id: "f-1026", numero: "F1026", estado, uuid_fiscal: "UUID-1", cancellation_status: cancellation };
}

function contexto(factura: FacturaRefacturacion | null): ContextoPasos {
  return {
    casoAbierto: true,
    clienteDestinoId: "cliente-2",
    motivo: "Pago desde otra razón social",
    pagos: [],
    facturaNueva: { id: "f-1035", numero: "F1035", estado: "Emitida", uuid_fiscal: "UUID-2" },
    original: factura,
    pagoSeleccionadoId: "p-1",
    pagoYaReasignado: false,
  };
}

describe("paso 4 · cancelación del CFDI original", () => {
  it("bloquea cuando no se ha solicitado la cancelación", () => {
    expect(bloqueoPaso(4, contexto(original("Pagada", null)))).toContain("Solicita la cancelación");
  });

  it("permite continuar cuando la cancelación está en trámite", () => {
    const ctx = contexto(original("Pagada", "pending"));
    expect(cancelacionOriginalEnTramite(ctx.original)).toBe(true);
    expect(bloqueoPaso(4, ctx)).toBeNull();
    expect(avisoPaso(4, ctx)).toContain("verificación");
  });

  it("permite continuar cuando el SAT sigue verificando", () => {
    expect(bloqueoPaso(4, contexto(original("Pagada", "verifying")))).toBeNull();
  });

  it("bloquea y avisa cuando el SAT rechazó la cancelación", () => {
    const ctx = contexto(original("Pagada", "rejected"));
    expect(cancelacionOriginalRechazada(ctx.original)).toBe(true);
    expect(bloqueoPaso(4, ctx)).toContain("no aceptó");
  });

  it("no bloquea ni avisa cuando ya está cancelada", () => {
    const ctx = contexto(original("Cancelada", "accepted"));
    expect(bloqueoPaso(4, ctx)).toBeNull();
    expect(avisoPaso(4, ctx)).toBeNull();
  });

  it("mantiene el paso 5 habilitado sin REP vivo", () => {
    expect(bloqueoPaso(5, contexto(original("Pagada", "pending")))).toBeNull();
  });
});
