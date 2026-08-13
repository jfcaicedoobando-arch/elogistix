import { describe, it, expect } from "vitest";
import {
  calcularExpedienteCliente,
  DOCUMENTOS_OBLIGATORIOS_CLIENTE,
  DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO,
  type DocumentoCliente,
} from "../documentosCliente";

const HOY = "2026-08-13";

function doc(tipo: DocumentoCliente["tipo"], venc?: string): DocumentoCliente {
  return {
    id: tipo,
    cliente_id: "c1",
    tipo,
    nombre: `${tipo}.pdf`,
    archivo: `clientes/c1/${tipo}.pdf`,
    mime_type: null,
    tamano_bytes: null,
    fecha_documento: null,
    fecha_vencimiento: venc ?? null,
    notas: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("documentosCliente", () => {
  it("exige la solicitud de crédito sólo cuando el cliente opera a crédito", () => {
    expect(DOCUMENTOS_OBLIGATORIOS_CLIENTE).not.toContain("Solicitud de crédito");
    expect(DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO).toContain("Solicitud de crédito");
    expect(calcularExpedienteCliente([], false, HOY).requeridos).toBe(3);
    expect(calcularExpedienteCliente([], true, HOY).requeridos).toBe(4);
  });

  it("marca el expediente completo cuando están los tres básicos", () => {
    const docs = [
      doc("Constancia de situación fiscal"),
      doc("Comprobante de domicilio"),
      doc("Contrato de servicios"),
    ];
    const r = calcularExpedienteCliente(docs, false, HOY);
    expect(r.cubiertos).toBe(3);
    expect(r.completitud).toBe(100);
  });

  it("no cuenta como cubierto un documento vencido", () => {
    const docs = [doc("Constancia de situación fiscal", "2026-01-01")];
    const r = calcularExpedienteCliente(docs, false, HOY);
    expect(r.vencidos).toBe(1);
    expect(r.cubiertos).toBe(0);
  });
});
