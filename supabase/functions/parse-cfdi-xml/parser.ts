// Parser puro para CFDI 4.0. Extrae atributos clave del XML sin AI.
// Se usa regex defensiva — XML CFDI es plano y predecible, y evitamos
// dependencias DOM en Deno. NO ejecuta DOCTYPE/entities (no hay superficie XXE).

export interface CfdiConcepto {
  descripcion: string;
  importe: number;
}

export interface CfdiParsed {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;            // ISO YYYY-MM-DD
  moneda: string;           // MXN / USD / EUR
  tipo_cambio: number;
  subtotal: number;
  total: number;
  iva_trasladado: number;
  retenciones: number;
  emisor: { rfc: string; nombre: string; regimen: string };
  receptor: { rfc: string; nombre: string };
  conceptos: CfdiConcepto[];
}

const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i");

function attr(tag: string, name: string): string {
  const m = tag.match(ATTR(name));
  return m ? m[1].trim() : "";
}

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findTag(xml: string, localName: string): string | null {
  // Acepta prefijo (cfdi:, tfd:) o sin prefijo. Toma el primer match.
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*/?>`, "i");
  const m = xml.match(re);
  return m ? m[0] : null;
}

function findAllTags(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${localName}\\b[^>]*/?>`, "gi");
  return xml.match(re) ?? [];
}

export function parseCfdi(xml: string): CfdiParsed {
  if (!xml || !xml.includes("Comprobante")) {
    throw new Error("XML no es un CFDI válido");
  }
  // Rechazar DOCTYPE para mitigar cualquier intento XXE aunque no usemos DOM.
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error("XML con DOCTYPE no permitido");
  }

  const comprobante = findTag(xml, "Comprobante");
  if (!comprobante) throw new Error("Falta elemento Comprobante");

  const version = attr(comprobante, "Version");
  if (!version.startsWith("4.")) {
    throw new Error(`Solo se acepta CFDI 4.0 (recibido: ${version || "desconocido"})`);
  }

  const tfd = findTag(xml, "TimbreFiscalDigital");
  const uuid = tfd ? attr(tfd, "UUID") : "";
  if (!uuid) throw new Error("CFDI sin timbre fiscal (UUID)");

  const emisor = findTag(xml, "Emisor") ?? "";
  const receptor = findTag(xml, "Receptor") ?? "";

  // Suma IVA trasladado a nivel Comprobante.
  let iva = 0;
  const totImp = findTag(xml, "Impuestos");
  if (totImp) {
    iva = num(attr(totImp, "TotalImpuestosTrasladados"));
  }
  const totRet = totImp ? num(attr(totImp, "TotalImpuestosRetenidos")) : 0;

  const conceptos: CfdiConcepto[] = findAllTags(xml, "Concepto").slice(0, 10).map((c) => ({
    descripcion: attr(c, "Descripcion"),
    importe: num(attr(c, "Importe")),
  }));

  const fechaRaw = attr(comprobante, "Fecha"); // 2025-03-14T10:22:01
  const fecha = fechaRaw.slice(0, 10);

  return {
    uuid,
    serie: attr(comprobante, "Serie"),
    folio: attr(comprobante, "Folio"),
    fecha,
    moneda: attr(comprobante, "Moneda") || "MXN",
    tipo_cambio: num(attr(comprobante, "TipoCambio")) || 1,
    subtotal: num(attr(comprobante, "SubTotal")),
    total: num(attr(comprobante, "Total")),
    iva_trasladado: iva,
    retenciones: totRet,
    emisor: {
      rfc: attr(emisor, "Rfc"),
      nombre: attr(emisor, "Nombre"),
      regimen: attr(emisor, "RegimenFiscal"),
    },
    receptor: {
      rfc: attr(receptor, "Rfc"),
      nombre: attr(receptor, "Nombre"),
    },
    conceptos,
  };
}
