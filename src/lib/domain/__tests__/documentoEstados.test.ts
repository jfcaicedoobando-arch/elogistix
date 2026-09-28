import { describe, it, expect } from "vitest";
import {
  resumenDocumento,
  resumenFacturaEmitida,
  resumenFacturaRecibida,
  resumenProforma,
} from "@/lib/domain/documentoEstados";

describe("documentoEstados — factura emitida", () => {
  it("ubica cada estado en su paso", () => {
    expect(resumenFacturaEmitida("Borrador").indiceActual).toBe(0);
    expect(resumenFacturaEmitida("Por timbrar").indiceActual).toBe(1);
    expect(resumenFacturaEmitida("Emitida").indiceActual).toBe(2);
    expect(resumenFacturaEmitida("Parcialmente pagada").indiceActual).toBe(2);
    expect(resumenFacturaEmitida("Vencida").indiceActual).toBe(2);
    expect(resumenFacturaEmitida("Pagada").indiceActual).toBe(3);
  });

  it("marca cancelada y sustituida como terminales", () => {
    const cancelada = resumenFacturaEmitida("Cancelada");
    expect(cancelada.terminal).toBe(true);
    expect(cancelada.etiquetaTerminal).toBe("Cancelada");
    expect(cancelada.indiceActual).toBe(-1);
    expect(resumenFacturaEmitida("Sustituida").etiquetaTerminal).toBe("Sustituida");
  });

  it("cae en el primer paso ante estados desconocidos", () => {
    expect(resumenFacturaEmitida(null).indiceActual).toBe(0);
    expect(resumenFacturaEmitida("Otro").indiceActual).toBe(0);
  });
});

describe("documentoEstados — factura recibida", () => {
  it("distingue borrador, vigente, aprobada y pagada", () => {
    expect(resumenFacturaRecibida({ estado: "Borrador" }).indiceActual).toBe(0);
    expect(resumenFacturaRecibida({ estado: "Vigente", estadoAprobacion: "pendiente" }).indiceActual).toBe(1);
    expect(resumenFacturaRecibida({ estado: "Vigente", estadoAprobacion: "aprobada" }).indiceActual).toBe(2);
    expect(resumenFacturaRecibida({ estado: "Pagada", estadoAprobacion: "aprobada" }).indiceActual).toBe(3);
  });

  it("marca cancelada y rechazada como terminales", () => {
    expect(resumenFacturaRecibida({ estado: "Cancelada" }).etiquetaTerminal).toBe("Cancelada");
    expect(
      resumenFacturaRecibida({ estado: "Vigente", estadoAprobacion: "rechazada" }).etiquetaTerminal,
    ).toBe("Rechazada");
  });
});

describe("resumenDocumento", () => {
  it("enruta al dominio correcto", () => {
    expect(resumenDocumento("factura_emitida", { estado: "Pagada" }).pasos[2].label).toBe("Emitida");
    expect(resumenDocumento("factura_recibida", { estado: "Pagada" }).pasos[2].label).toBe("Aprobada");
  });
});

describe("resumenProforma — conversión vs emisión (B9)", () => {
  it("se queda en Aceptada con matiz cuando la factura no se emitió", () => {
    const r = resumenProforma({
      estadoCliente: "aceptada",
      facturada: true,
      facturaEmitida: false,
      etiquetaConversion: "Convertida a borrador",
    });
    expect(r.indiceActual).toBe(2);
    expect(r.subEtiqueta).toBe("Convertida a borrador");
  });

  it("llega a Facturada cuando la factura ya se emitió", () => {
    expect(resumenProforma({ estadoCliente: "aceptada", facturada: true, facturaEmitida: true }).indiceActual).toBe(3);
  });

  it("mantiene el comportamiento previo si no se conocen las facturas", () => {
    expect(resumenProforma({ estadoCliente: "aceptada", facturada: true }).indiceActual).toBe(3);
  });
});

describe("resumenProforma — pasos omitidos (R170-06)", () => {
  it("marca 'Enviada' como omitida (no completada) cuando se aprobó internamente sin enviadaAt", () => {
    const r = resumenProforma({ estadoCliente: "aceptada", facturada: false, enviadaAt: null });
    expect(r.indiceActual).toBe(2);
    expect(r.pasosOmitidos).toContain("enviada");
  });

  it("no marca 'Enviada' como omitida cuando sí se envió al cliente antes de aceptar", () => {
    const r = resumenProforma({ estadoCliente: "aceptada", facturada: false, enviadaAt: "2026-01-01" });
    expect(r.pasosOmitidos).toEqual([]);
  });
});


describe("resumenProforma — cliente sin autorización externa (V-11)", () => {
  it("muestra aprobación interna como paso actual aunque la proforma se hubiera enviado por correo", () => {
    const r = resumenProforma({
      estadoCliente: "pendiente",
      facturada: false,
      enviadaAt: "2026-09-01",
      requiereAutorizacion: false,
    });
    expect(r.pasos.map((paso) => paso.label)).toEqual(["Emitida", "Aprobación interna", "Facturada"]);
    expect(r.indiceActual).toBe(1);
    expect(r.subEtiqueta).toBeNull();
  });

  it("mantiene la aprobación interna como último paso completado hasta facturar", () => {
    const r = resumenProforma({
      estadoCliente: "aceptada",
      facturada: false,
      requiereAutorizacion: false,
    });
    expect(r.indiceActual).toBe(1);
    expect(r.pasos[r.indiceActual].label).toBe("Aprobación interna");
  });

  it("conserva los pasos de cliente para proformas que sí requieren autorización", () => {
    const r = resumenProforma({
      estadoCliente: "pendiente",
      facturada: false,
      enviadaAt: "2026-09-01",
      requiereAutorizacion: true,
    });
    expect(r.pasos.map((paso) => paso.label)).toEqual(["Emitida", "Enviada", "Aceptada", "Facturada"]);
    expect(r.subEtiqueta).toBe("Pendiente del cliente");
  });

  it("no atribuye el rechazo al cliente cuando la aprobación es interna", () => {
    const r = resumenProforma({
      estadoCliente: "rechazada",
      facturada: false,
      requiereAutorizacion: false,
    });
    expect(r.etiquetaTerminal).toBe("Rechazada");
  });
});
