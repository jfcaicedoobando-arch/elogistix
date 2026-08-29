/** Config compartida de reglas de Auditoría: label, descripción, icono y orden canónico. */
import {
  Clock, FileWarning, FileX, FileX2, Receipt, FileCheck, FileSpreadsheet, FileClock,
  Scale, Stamp, Ban, Banknote, HandCoins, AlertOctagon, Container, CalendarClock,
  TrendingDown, Copy, type LucideIcon,
} from "lucide-react";
import type { ReglaAuditoria } from "@/features/auditoria/types";


export { reglaShortLabel } from "@/features/auditoria/domain/reglaLabels";

export interface ReglaInfo {
  /** Etiqueta corta para tablas/badges. */
  shortLabel: string;
  /** Etiqueta extendida para vistas ejecutivas/accordions. */
  label: string;
  /** Descripción larga para tooltips y headers. */
  description: string;
  icon: LucideIcon;
}

export const REGLA_INFO: Record<ReglaAuditoria, ReglaInfo> = {
  docs_faltantes: {
    shortLabel: "Documentos faltantes",
    label: "Documentos faltantes según etapa",
    description:
      "Documentos obligatorios que aún no se cargan para el estado actual del embarque.",
    icon: FileWarning,
  },
  docs_pendientes_avanzado: {
    shortLabel: "Documentos pendientes en avanzados",
    label: "Documentos pendientes en embarques avanzados",
    description:
      "Documentos en estado 'Pendiente' aunque el embarque ya está en operación o cerrado.",
    icon: FileX,
  },
  fechas: {
    shortLabel: "Inconsistencias de fechas",
    label: "Estados inconsistentes con fechas",
    description: "ETD/ETA o fechas reales que no concuerdan con el estado registrado.",
    icon: Clock,
  },
  ventas_sin_facturar: {
    shortLabel: "Ventas sin facturar",
    label: "Ventas pendientes de facturar",
    description: "Embarques entregados o cerrados con conceptos de venta sin facturar.",
    icon: Receipt,
  },
  margen_negativo: {
    shortLabel: "Margen estimado negativo",
    label: "Embarques con margen estimado negativo",
    description:
      "Utilidad ESTIMADA en MXN menor a cero, calculada con los conceptos de venta y costo del embarque (presupuesto). Puede diferir del P&L real facturado.",
    icon: TrendingDown,
  },
  margen_bajo: {
    shortLabel: "Margen estimado bajo",
    label: "Embarques con margen estimado bajo",
    description:
      "Margen ESTIMADO positivo pero por debajo del mínimo configurado. Se calcula con conceptos de venta y costo, no con facturas reales.",
    icon: Scale,
  },
  venta_sin_costo: {
    shortLabel: "Venta sin costo",
    label: "Ventas sin costos cargados",
    description: "Embarques con conceptos de venta pero sin un solo costo registrado.",
    icon: FileX2,
  },
  costo_sin_venta: {
    shortLabel: "Costo sin venta",
    label: "Costos sin venta facturable",
    description: "Embarques cerrados o entregados con costos cargados pero sin venta.",
    icon: FileX2,
  },
  costos_repetidos: {
    shortLabel: "Costos repetidos",
    label: "Costos idénticos repetidos (posible duplicado)",
    description:
      "Embarques con costos idénticos (mismo concepto, importe y moneda) repetidos cuando el número de copias NO coincide con el número de contenedores. Los prorrateos legítimos por contenedor no se marcan.",
    icon: Copy,
  },
  proforma_vencida: {
    shortLabel: "Proforma vencida",
    label: "Proformas vencidas sin factura",
    description:
      "Proformas emitidas con más días que el umbral configurado y aún sin factura.",
    icon: CalendarClock,
  },
  proforma_borrador_abandonada: {
    shortLabel: "Borrador abandonado",
    label: "Borrador de proforma abandonada",
    description:
      "Proformas en estado borrador con total cero o sin conceptos vinculados desde hace más del umbral configurado.",
    icon: FileClock,
  },
  proforma_inconsistente: {
    shortLabel: "Proforma inconsistente",
    label: "Proforma inconsistente con conceptos pendientes",
    description:
      "Borrador de proforma vacío vinculado al mismo embarque donde existen conceptos de venta pendientes sin asignar.",
    icon: FileSpreadsheet,
  },
  embarque_huerfano: {
    shortLabel: "Embarque huérfano",
    label: "Embarques huérfanos",
    description:
      "Embarques activos sin operador asignado o sin movimientos recientes en bitácora.",
    icon: Clock,
  },
  factura_sin_timbrar: {
    shortLabel: "Factura sin timbrar",
    label: "Facturas sin timbrar",
    description:
      "Facturas creadas hace más de 48 horas que siguen sin timbrarse ante el SAT vía FacturAPI.",
    icon: Stamp,
  },
  rep_pendiente: {
    shortLabel: "REP pendiente",
    label: "Recibo Electrónico de Pago pendiente",
    description:
      "Pago aplicado a una factura PPD cuyo REP lleva más de 72 horas sin emitirse.",
    icon: FileCheck,
  },
  factura_cancelada_sin_sustitucion: {
    shortLabel: "Cancelada sin sustitución",
    label: "Factura cancelada motivo 01 sin sustituta",
    description:
      "Factura cancelada con motivo SAT 01 (sustitución) sin folio sustituto emitido tras 24 horas.",
    icon: Ban,
  },
  cxc_vencida: {
    shortLabel: "CXC vencida",
    label: "Cuenta por cobrar vencida",
    description:
      "Factura timbrada al cliente cuya fecha de vencimiento ya pasó y conserva saldo pendiente.",
    icon: AlertOctagon,
  },
  cxp_por_capturar_estancada: {
    shortLabel: "CXP por capturar",
    label: "Factura de proveedor estancada en captura",
    description:
      "Factura de proveedor que permanece en estado 'por capturar' más allá del umbral configurado.",
    icon: HandCoins,
  },
  cxp_vencida: {
    shortLabel: "CXP vencida",
    label: "Cuenta por pagar a proveedor vencida",
    description:
      "Factura de proveedor vigente cuya fecha de vencimiento ya pasó sin que se haya programado el pago.",
    icon: Banknote,
  },
  contenedor_datos_incompletos: {
    shortLabel: "Contenedor sin peso/volumen",
    label: "Contenedores sin peso o volumen",
    description:
      "Embarques marítimos FCL avanzados con contenedores donde falta capturar peso o volumen.",
    icon: Container,
  },
  contenedor_fechas_incompletas: {
    shortLabel: "Contenedor sin fechas",
    label: "Contenedores sin fecha de descarga o devolución",
    description:
      "Embarques Entregado o Cerrado con contenedores cuya fecha de descarga o devolución no ha sido capturada.",
    icon: CalendarClock,
  },
  tipo_cambio_faltante: {
    shortLabel: "Tipo de cambio faltante",
    label: "Embarques sin tipo de cambio capturado",
    description:
      "Embarques con conceptos en USD o EUR que no tienen tipo de cambio capturado. El margen no se calcula hasta corregir el TC.",
    icon: Scale,
  },
  venta_total_descuadrado: {
    shortLabel: "Venta descuadrada",
    label: "Total de venta no cuadra con conceptos",
    description:
      "Embarques cuyo total de venta registrado no coincide con la suma de sus conceptos de venta (descuadre mayor a la tolerancia).",
    icon: Scale,
  },
};

/** Orden canónico de presentación (mayor severidad operativa primero). */
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
