/**
 * Capacidades operativas y comerciales por rol (datos puros, sin React).
 */
import type { AppRole } from "@/types/appRole";

export const COTIZAR_SIN_DESGLOSE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
];

// v13.303.26 — eliminado `CREAR_EMBARQUE_LIBRE`: la política tarifa-first no admite
// excepciones, todo embarque nuevo nace de una cotización aceptada.

export const OVERRIDE_TARIFA_PRICING: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
];

// v13.106.4 — El cierre de embarques pasa de finanzas a operaciones.
export const CERRAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
];

// v13.118.0 — Handoff cotización → embarque (Vendedor confirma con cliente y
// pasa el balón al Coordinador Logístico para ejecutar).
export const HANDOFF_COTIZACION: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
  "coordinador_logistico",
  "vendedor",
];

// v13.145.8 — Aceptar/Rechazar proforma manualmente (cuando el cliente
// confirma por WhatsApp/llamada/email) queda limitado a admins y gerentes.
export const RESPONDER_PROFORMA_MANUAL: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
];

// FIX C1 (S5-01) — Espejo UI del guard SQL de `eliminar_embarque_completo`:
// super_admin o admin/operador (jerarquía `has_role`) de la misma organización.
export const ELIMINAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
];

/**
 * v13.489.0 — Segregación de funciones en el buzón de facturas de proveedor del
 * embarque (tab Costos): operaciones entrega los PDF/XML del agente y
 * contabilidad los captura después en CxP. Espejo de la política RLS
 * "Operaciones sube facturas entrantes" de `embarque_facturas_entrantes`, que
 * ya no acepta a contador ni a auxiliar contable.
 */
export const SUBIR_FACTURA_ENTRANTE_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "operador",
  "coordinador_logistico",
  "gerente_operaciones",
];

/**
 * RNF-08 (Ola 11) — Adjuntar el XML faltante a un documento ya subido al buzón.
 * El plan de permisos contables lo conserva para contabilidad, así que la
 * capacidad es la unión de quien sube (operaciones) y quien captura
 * (contabilidad). Espejo de la RPC `adjuntar_xml_factura_entrante`.
 */
export const ADJUNTAR_XML_FACTURA_ENTRANTE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "operador",
  "coordinador_logistico",
  "gerente_operaciones",
  "contador",
  "auxiliar_contable",
];
