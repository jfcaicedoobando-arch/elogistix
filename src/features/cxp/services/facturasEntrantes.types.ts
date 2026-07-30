/**
 * v13.361.2 — Tipos y constantes compartidas del buzón de facturas de proveedor.
 * Extraído de `facturasEntrantes.ts` (Power of 10: archivos ≤ 200 líneas).
 */
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

export const BUCKET_CXP_INBOX = "cxp-inbox";

export interface FacturaEntranteRow {
  id: string;
  embarque_id: string;
  organization_id: string;
  archivo_path: string;
  archivo_hash: string;
  nombre_archivo: string;
  xml_path: string | null;
  xml_nombre: string | null;
  uuid_fiscal: string | null;
  rfc_emisor: string | null;
  folio_serie: string | null;
  fecha_emision: string | null;
  nota: string | null;
  estado: string;
  proveedor_id: string | null;
  proveedor_factura_id: string | null;
  folio_detectado: string | null;
  total_detectado: number | null;
  moneda_detectada: string | null;
  rechazo_motivo: string | null;
  subido_por: string | null;
  capturado_por: string | null;
  created_at: string;
  embarques?: { expediente: string | null } | null;
  proveedores?: { nombre: string | null; origen_proveedor?: string | null } | null;
}

export const SELECT_COLS_ENTRANTES =
  "id, embarque_id, organization_id, archivo_path, archivo_hash, nombre_archivo, nota, estado," +
  " xml_path, xml_nombre, uuid_fiscal, rfc_emisor, folio_serie, fecha_emision," +
  " proveedor_id, proveedor_factura_id, folio_detectado, total_detectado, moneda_detectada," +
  " rechazo_motivo, subido_por, capturado_por, created_at," +
  " embarques:embarque_id(expediente), proveedores:proveedor_id(nombre, origen)";

export interface SubirFacturaEntranteInput {
  /** PDF de la factura (opcional si el proveedor sólo mandó el XML). */
  pdf: File | null;
  /** XML del CFDI (proveedores mexicanos). */
  xml: File | null;
  meta?: CfdiXmlMeta | null;
  embarqueId: string;
  organizationId: string;
  proveedorId?: string | null;
  nota?: string | null;
}

/** Traduce errores de unicidad de Postgres a un mensaje entendible. */
export function mensajeDuplicadoEntrante(mensaje: string): string | null {
  if (/uq_efe_uuid_fiscal/i.test(mensaje)) {
    return "El XML de esta factura ya está en el buzón (mismo UUID fiscal).";
  }
  if (/duplicate key|unique/i.test(mensaje)) {
    return "Este archivo ya fue subido al buzón de este embarque.";
  }
  return null;
}
