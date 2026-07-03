import { describe, it, expect } from "vitest";
import {
  resolveEstadoCliente,
  resolveProformaTimelineFields,
} from "@/features/proformas/domain/proformaClienteEstado";
import type { ProformaDetalleFull } from "@/features/proformas/services";

describe("proformaClienteEstado", () => {
  it("resolveEstadoCliente reconoce aceptada / rechazada / default pendiente", () => {
    expect(resolveEstadoCliente("aceptada")).toBe("aceptada");
    expect(resolveEstadoCliente("rechazada")).toBe("rechazada");
    expect(resolveEstadoCliente(null)).toBe("pendiente");
    expect(resolveEstadoCliente(undefined)).toBe("pendiente");
    expect(resolveEstadoCliente("otro")).toBe("pendiente");
  });

  it("resolveProformaTimelineFields normaliza todos los campos y default a pendiente", () => {
    const raw = {
      estado_cliente: "aceptada",
      aceptada_por: "op@x.com",
      enviada_at: "2026-01-01",
      enviada_por: "s@x.com",
      aceptada_at: "2026-01-02",
      rechazada_at: null,
      fecha_facturacion: "2026-01-03",
    } as unknown as ProformaDetalleFull;
    const t = resolveProformaTimelineFields(raw);
    expect(t).toEqual({
      estadoCliente: "aceptada",
      aceptadaPor: "op@x.com",
      enviadaAt: "2026-01-01",
      enviadaPor: "s@x.com",
      aceptadaAt: "2026-01-02",
      rechazadaAt: null,
      fechaFacturacion: "2026-01-03",
    });
  });

  it("resolveProformaTimelineFields sin campos extra devuelve nulls y pendiente", () => {
    const t = resolveProformaTimelineFields({} as ProformaDetalleFull);
    expect(t.estadoCliente).toBe("pendiente");
    expect(t.aceptadaPor).toBeNull();
    expect(t.enviadaAt).toBeNull();
    expect(t.fechaFacturacion).toBeNull();
  });
});
