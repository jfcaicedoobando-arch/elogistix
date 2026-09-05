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
