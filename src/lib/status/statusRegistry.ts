/**
 * Registry único de estados visuales por dominio.
 *
 * Consume `estadoConfig` (fuente de verdad de colores/iconos) y expone un
 * mapeo `domain -> status -> { label, badgeClass, variant?, icon? }` que
 * consume `<StatusBadge />`.
 *
 * Los helpers legacy (`getEstadoColor`, `BadgeCiclo`, etc.) siguen vivos y
 * serán deprecados en la Oleada 2.
 */
import type { LucideIcon } from "lucide-react";
import {
  ESTADO_CONFIG,
  getEstadoVisual,
  type EstadoVisual,
} from "@/lib/ui/estadoConfig";
import { EXTRA_STATUS_BADGES } from "@/lib/status/statusExtras";

export type StatusDomain =
  | "factura"
  | "factura_cxp"
  | "proforma"
  | "embarque"
  | "cotizacion"
  | "lead"
  | "comision"
  | "org"
  // Añadidos v13.172.21 — homologación de badges en tablas.
  | "aprobacion_cxp"      // CxP flujo de aprobación
  | "captura_cxp"         // Bandeja "Por capturar" (avance CFDI)
  | "actividad_crm"       // Actividad CRM: Completada / Pendiente
  | "tarifa_maritima"     // Estado de aprobación de tarifa de agente
  | "agente"              // Alta/baja de agentes de costeo (masculino)
  | "garantia_naviera"    // Ciclo de vida de garantía por contenedor
  | "ruta_maritima"       // Salud de ruta (Activa/Por vencer/Sin tarifa)
  | "liquidacion"         // Pago de operación de proveedor
  | "anticipo_proveedor"; // QW6 — Anticipos a proveedores

export interface StatusVisual {
  label: string;
  badgeClass: string;
  icon?: LucideIcon;
}

/** Dominio → lista de estados canónicos (para tests y filtros). */
export const DOMAIN_STATUSES: Record<StatusDomain, readonly string[]> = {
  factura: [
    "Borrador",
    "Emitida",
    "Pagada",
    "Parcialmente pagada",
    "Vencida",
    "En cancelación",
    "Cancelada",
    "Sustituida",
    "Pendiente",
  ],
  factura_cxp: [
    "Vigente",
    "Parcial",
    "Por vencer",
    "Vencida",
    "Por aprobar",
    "Rechazada",
    "Borrador",
    "Pagada",
    "Cancelada",
  ],
  proforma: [
    "Borrador",
    "Enviada",
    "Aceptada",
    "Rechazada",
    "Cancelada",
  ],
  embarque: [
    "Confirmado",
    "En Tránsito",
    "Arribo",
    "En Aduana",
    "EIR",
    "Entregado",
    "Cerrado",
    "Cancelado",
  ],
  cotizacion: [
    "Borrador",
    "Solicitada",
    "Enviada",
    "Aceptada",
    "Confirmada",
    "Rechazada",
    "En operación",
    "Archivada",
  ],
  lead: [
    "Nuevo",
    "Contactado",
    "Calificado",
    "Descalificado",
    "Convertido",
    "Descartado",
  ],
  comision: [
    "Devengada",
    "Liquidada",
    "Cancelada",
  ],
  org: [
    "Activa",
    "Inactiva",
  ],
  aprobacion_cxp: ["Por aprobar", "Aprobada", "Rechazada"],
  captura_cxp: ["Sin captura", "Parcial", "Completo"],
  actividad_crm: ["Pendiente", "Completada", "Vencida"],
  tarifa_maritima: ["Borrador", "Vigente", "Rechazada"],
  agente: ["Activo", "Inactivo"],
  garantia_naviera: ["Pendiente", "Depositado", "Liberado", "Retenido"],
  ruta_maritima: ["Activa", "Por vencer", "Sin tarifa"],
  liquidacion: ["Pagado", "Pendiente"],
  anticipo_proveedor: ["disponible", "aplicado_parcial", "aplicado_total", "cancelado"],
};

/** Overrides por dominio cuando el mismo string necesita otro label. */
const LABEL_OVERRIDES: Partial<Record<StatusDomain, Record<string, string>>> = {
  anticipo_proveedor: {
    disponible: "Disponible",
    aplicado_parcial: "Aplicado parcial",
    aplicado_total: "Aplicado total",
    cancelado: "Cancelado",
  },
  lead: {
    Nuevo: "Nuevo",
    Contactado: "Contactado",
    Calificado: "Calificado",
    Descartado: "Descartado",
  },
};

const EXTRA = EXTRA_STATUS_BADGES;

/**
 * Devuelve la config visual de un estado en un dominio dado.
 * Fallback seguro: si el estado no existe, devuelve gris "neutral".
 */
export function getStatusVisual(
  domain: StatusDomain,
  status: string | null | undefined,
): StatusVisual {
  const raw = (status ?? "").trim();
  if (!raw) {
    return {
      label: "—",
      badgeClass: "bg-muted text-muted-foreground border border-border",
    };
  }
  const override = LABEL_OVERRIDES[domain]?.[raw];
  const extra = EXTRA[raw];
  const visual: EstadoVisual | undefined = ESTADO_CONFIG[raw];
  if (!visual && extra) {
    return { label: override ?? raw, badgeClass: extra };
  }
  const fallback = getEstadoVisual(raw);
  return {
    label: override ?? raw,
    badgeClass: fallback.badge,
    icon: fallback.icon,
  };
}
