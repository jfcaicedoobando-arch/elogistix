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

export type StatusDomain =
  | "factura"
  | "proforma"
  | "embarque"
  | "cotizacion"
  | "lead";

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
    "Cancelada",
    "Pendiente",
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
    "Descartado",
  ],
};

/** Overrides por dominio cuando el mismo string necesita otro label. */
const LABEL_OVERRIDES: Partial<Record<StatusDomain, Record<string, string>>> = {
  lead: {
    Nuevo: "Nuevo",
    Contactado: "Contactado",
    Calificado: "Calificado",
    Descartado: "Descartado",
  },
};

/** Estilos ad-hoc para dominios/estados que no están en `ESTADO_CONFIG`. */
const EXTRA: Record<string, EstadoVisual["badge"]> = {
  Nuevo: "bg-info/15 text-info border border-info/30",
  Contactado: "bg-warning/15 text-warning border border-warning/30",
  Calificado: "bg-success/15 text-success border border-success/30",
  Descartado: "bg-muted text-muted-foreground border border-border",
};

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
