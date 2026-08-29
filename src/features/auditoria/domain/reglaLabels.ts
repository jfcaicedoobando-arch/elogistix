/**
 * Etiquetas cortas de reglas de auditoría — datos puros sin dependencias de UI.
 * Fuente única consumida tanto por exportadores en `src/lib/` como por la
 * configuración visual en `src/components/shared/utils/auditoriaConfig.ts`.
 */
import type { ReglaAuditoria } from "@/features/auditoria/types";

export const REGLA_SHORT_LABELS: Record<ReglaAuditoria, string> = {
  docs_faltantes: "Documentos faltantes",
  docs_pendientes_avanzado: "Documentos pendientes en avanzados",
  fechas: "Inconsistencias de fechas",
  ventas_sin_facturar: "Ventas sin facturar",
  margen_negativo: "Margen estimado negativo",
  margen_bajo: "Margen estimado bajo",
  venta_sin_costo: "Venta sin costo",
  costo_sin_venta: "Costo sin venta",
  costos_repetidos: "Costos repetidos",
  proforma_vencida: "Proforma vencida",
  proforma_borrador_abandonada: "Borrador abandonado",
  proforma_inconsistente: "Proforma inconsistente",
  embarque_huerfano: "Embarque huérfano",
  factura_sin_timbrar: "Factura sin timbrar",
  rep_pendiente: "REP pendiente",
  factura_cancelada_sin_sustitucion: "Cancelada sin sustitución",
  cxc_vencida: "CXC vencida",
  cxp_por_capturar_estancada: "CXP por capturar",
  cxp_vencida: "CXP vencida",
  contenedor_datos_incompletos: "Contenedor sin peso/volumen",
  contenedor_fechas_incompletas: "Contenedor sin fechas",
  tipo_cambio_faltante: "Tipo de cambio faltante",
  venta_total_descuadrado: "Total de venta descuadrado",
};

export function reglaShortLabel(regla: ReglaAuditoria): string {
  return REGLA_SHORT_LABELS[regla];
}
