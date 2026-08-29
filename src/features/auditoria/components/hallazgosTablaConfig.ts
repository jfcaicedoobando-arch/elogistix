/**
 * Constantes de UI para la tabla de hallazgos de auditoría.
 */
import type { ReglaAuditoria, SeveridadAuditoria } from "@/features/auditoria/types";

export const reglaLabel: Record<ReglaAuditoria, string> = {
  docs_faltantes: "Docs faltantes",
  docs_pendientes_avanzado: "Docs pendientes (avanzado)",
  fechas: "Fechas inconsistentes",
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
  venta_total_descuadrado: "Venta total descuadrada",
  contenedores_totales_descuadrados: "Totales vs contenedores",
};

export const reglaToTab: Record<ReglaAuditoria, string> = {
  docs_faltantes: "documentos",
  docs_pendientes_avanzado: "documentos",
  fechas: "tracking",
  ventas_sin_facturar: "facturacion",
  margen_negativo: "financiero",
  margen_bajo: "financiero",
  venta_sin_costo: "financiero",
  costo_sin_venta: "financiero",
  costos_repetidos: "financiero",
  proforma_vencida: "facturacion",
  proforma_borrador_abandonada: "facturacion",
  proforma_inconsistente: "facturacion",
  embarque_huerfano: "tracking",
  factura_sin_timbrar: "facturacion",
  rep_pendiente: "facturacion",
  factura_cancelada_sin_sustitucion: "facturacion",
  cxc_vencida: "facturacion",
  cxp_por_capturar_estancada: "facturacion",
  cxp_vencida: "facturacion",
  contenedor_datos_incompletos: "resumen",
  contenedor_fechas_incompletas: "resumen",
  tipo_cambio_faltante: "financiero",
  venta_total_descuadrado: "financiero",
  contenedores_totales_descuadrados: "resumen",
};

export const severidadConfig: Record<
  SeveridadAuditoria,
  { label: string; className: string }
> = {
  critico: {
    label: "Crítico",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  alto: {
    label: "Alto",
    className: "bg-warning/15 text-warning dark:text-warning border-warning/30",
  },
  medio: {
    label: "Medio",
    className: "bg-primary/15 text-primary border-primary/30",
  },
};

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

