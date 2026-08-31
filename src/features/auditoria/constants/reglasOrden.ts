/**
 * Orden canónico de presentación de reglas de Auditoría
 * (mayor severidad operativa primero).
 *
 * Extraído de `auditoriaConfig.ts` (límite Power-of-10 de 200 líneas).
 */
import type { ReglaAuditoria } from "@/features/auditoria/types";

export const REGLAS_ORDEN: ReglaAuditoria[] = [
  "factura_cancelada_sin_sustitucion",
  "cxc_vencida",
  "cxp_vencida",
  "docs_pendientes_avanzado",
  "ventas_sin_facturar",
  "margen_negativo",
  "factura_sin_timbrar",
  "rep_pendiente",
  "cxp_por_capturar_estancada",
  "contenedor_datos_incompletos",
  "contenedor_fechas_incompletas",
  "margen_bajo",
  "venta_total_descuadrado",
  "contenedores_totales_descuadrados",
  "proforma_inconsistente",
  "proforma_vencida",
  "proforma_borrador_abandonada",
  "venta_sin_costo",
  "costo_sin_venta",
  "costos_repetidos",
  "embarque_huerfano",
  "docs_faltantes",
  "fechas",
  "tipo_cambio_faltante",
];
