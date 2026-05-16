/**
 * Configuración compartida de las reglas de Auditoría:
 * label corto, descripción larga, icono y orden canónico de presentación.
 *
 * Antes esta configuración estaba duplicada entre `pages/Auditoria.tsx`
 * (versión completa con descripción + icono) y `AuditoriaEjecutivoTab.tsx`
 * (versión corta solo con label). Centralizar evita drift.
 */
import {
  Clock,
  FileWarning,
  FileX,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { ReglaAuditoria } from "@/types/auditoria";

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
    shortLabel: "Margen negativo",
    label: "Embarques con margen negativo",
    description: "Embarques cuya utilidad en MXN es menor a cero (pérdida).",
    icon: Receipt,
  },
  margen_bajo: {
    shortLabel: "Margen bajo",
    label: "Embarques con margen bajo",
    description: "Margen positivo pero por debajo del mínimo configurado para la organización.",
    icon: Receipt,
  },
  venta_sin_costo: {
    shortLabel: "Venta sin costo",
    label: "Ventas sin costos cargados",
    description: "Embarques con conceptos de venta pero sin un solo costo registrado.",
    icon: Receipt,
  },
  costo_sin_venta: {
    shortLabel: "Costo sin venta",
    label: "Costos sin venta facturable",
    description: "Embarques cerrados o entregados con costos cargados pero sin venta.",
    icon: Receipt,
  },
  proforma_vencida: {
    shortLabel: "Proforma vencida",
    label: "Proformas vencidas sin factura",
    description:
      "Proformas emitidas con más días que el umbral configurado y aún sin factura.",
    icon: Receipt,
  },
  embarque_huerfano: {
    shortLabel: "Embarque huérfano",
    label: "Embarques huérfanos",
    description:
      "Embarques activos sin operador asignado o sin movimientos recientes en bitácora.",
    icon: Clock,
  },
};

/** Orden canónico de presentación (mayor severidad operativa primero). */
export const REGLAS_ORDEN: ReglaAuditoria[] = [
  "docs_pendientes_avanzado",
  "ventas_sin_facturar",
  "margen_negativo",
  "margen_bajo",
  "proforma_vencida",
  "venta_sin_costo",
  "costo_sin_venta",
  "embarque_huerfano",
  "docs_faltantes",
  "fechas",
];

export function reglaShortLabel(regla: ReglaAuditoria): string {
  return REGLA_INFO[regla].shortLabel;
}

