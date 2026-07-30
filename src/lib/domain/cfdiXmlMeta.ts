/**
 * Lectura de metadatos del XML de un CFDI 3.3/4.0 en el cliente.
 *
 * Los proveedores mexicanos envían PDF + XML. El XML es la fuente fiscal real:
 * de ahí sacamos UUID, RFC emisor, folio, total, moneda y fecha para que
 * contabilidad no vuelva a teclearlos y para detectar duplicados.
 *
 * Sólo se leen atributos del nodo `Comprobante`, `Emisor` y del complemento
 * `TimbreFiscalDigital`; no se valida el sello (eso ya lo hace la Edge
 * Function `parse-cfdi-xml` al capturar la factura).
 */
import { parseImporteFiscal } from "@/lib/domain/facturaConceptos";

export interface CfdiXmlMeta {
  uuid: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  folioSerie: string | null;
  total: number | null;
  moneda: string | null;
  fechaEmision: string | null;
}

export const CFDI_XML_META_VACIO: CfdiXmlMeta = {
  uuid: null,
  rfcEmisor: null,
  nombreEmisor: null,
  folioSerie: null,
  total: null,
  moneda: null,
  fechaEmision: null,
};

function attr(el: Element | null | undefined, nombre: string): string | null {
  const valor = el?.getAttribute(nombre)?.trim();
  return valor ? valor : null;
}

/** Busca el primer elemento cuyo nombre local coincida (ignora el prefijo). */
function firstByLocalName(root: Document | Element, local: string): Element | null {
  const lista = root.getElementsByTagName("*");
  for (let i = 0; i < lista.length; i += 1) {
    const el = lista.item(i);
    if (el && (el.localName === local || el.nodeName.split(":").pop() === local)) return el;
  }
  return null;
}

function armarFolioSerie(comprobante: Element | null): string | null {
  const serie = attr(comprobante, "Serie") ?? attr(comprobante, "serie");
  const folio = attr(comprobante, "Folio") ?? attr(comprobante, "folio");
  if (serie && folio) return `${serie}-${folio}`;
  return folio ?? serie ?? null;
}

/** Normaliza `2026-07-30T12:00:00` a `2026-07-30` (fecha local del CFDI). */
export function fechaCfdiADia(valor: string | null): string | null {
  if (!valor) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(valor.trim());
  return match ? match[1] : null;
}

/**
 * Extrae los metadatos del XML. Devuelve campos en `null` cuando el archivo no
 * es un CFDI válido: la subida al buzón nunca se bloquea por esto.
 */
export function extraerCfdiXmlMeta(xmlTexto: string): CfdiXmlMeta {
  if (typeof DOMParser === "undefined") return { ...CFDI_XML_META_VACIO };
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlTexto, "application/xml");
  } catch {
    return { ...CFDI_XML_META_VACIO };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return { ...CFDI_XML_META_VACIO };

  const comprobante = firstByLocalName(doc, "Comprobante");
  if (!comprobante) return { ...CFDI_XML_META_VACIO };
  const emisor = firstByLocalName(comprobante, "Emisor");
  const timbre = firstByLocalName(doc, "TimbreFiscalDigital");
  const totalRaw = attr(comprobante, "Total") ?? attr(comprobante, "total");
  const uuid = attr(timbre, "UUID");

  return {
    uuid: uuid ? uuid.toUpperCase() : null,
    rfcEmisor: (attr(emisor, "Rfc") ?? attr(emisor, "rfc"))?.toUpperCase() ?? null,
    nombreEmisor: attr(emisor, "Nombre") ?? attr(emisor, "nombre"),
    folioSerie: armarFolioSerie(comprobante),
    total: totalRaw == null ? null : parseImporteFiscal(totalRaw, 0),
    moneda: (attr(comprobante, "Moneda") ?? attr(comprobante, "moneda"))?.toUpperCase() ?? null,
    fechaEmision: fechaCfdiADia(attr(comprobante, "Fecha") ?? attr(comprobante, "fecha")),
  };
}

/** Lee el archivo y extrae los metadatos. */
export async function extraerCfdiXmlMetaDeArchivo(file: File): Promise<CfdiXmlMeta> {
  const texto = await file.text();
  return extraerCfdiXmlMeta(texto);
}

/** ¿El XML trae lo mínimo para servir como comprobante fiscal? */
export function metaCfdiUtil(meta: CfdiXmlMeta): boolean {
  return Boolean(meta.uuid && meta.rfcEmisor);
}
