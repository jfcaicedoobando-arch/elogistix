/**
 * Mapeo puro de archivos + metadatos del CFDI al renglón de
 * `embarque_facturas_entrantes`. Vive aparte del servicio para mantener bajo
 * el tamaño y la complejidad de cada archivo (regla Power of 10).
 */
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

export interface ArchivoSubido {
  path: string;
  hash: string;
  nombre: string;
}

/** Ranuras de archivo: el XML puede ser el principal (sólo XML) o el segundo. */
export function columnasXmlEntrante(params: {
  soloXml: boolean;
  principal: ArchivoSubido;
  xmlSubido: ArchivoSubido | null;
}) {
  const fuente = params.xmlSubido ?? (params.soloXml ? params.principal : null);
  return {
    xml_path: fuente?.path ?? null,
    xml_nombre: fuente?.nombre ?? null,
    xml_hash: fuente?.hash ?? null,
  };
}

/** Datos fiscales leídos del XML; todo opcional porque el PDF puede venir solo. */
export function columnasMetaEntrante(meta: CfdiXmlMeta | null | undefined) {
  const m: Partial<CfdiXmlMeta> = meta ?? {};
  return {
    uuid_fiscal: m.uuid ?? null,
    rfc_emisor: m.rfcEmisor ?? null,
    folio_serie: m.folioSerie ?? null,
    fecha_emision: m.fechaEmision ?? null,
    folio_detectado: m.folioSerie ?? null,
    total_detectado: m.total ?? null,
    moneda_detectada: m.moneda ?? null,
  };
}
