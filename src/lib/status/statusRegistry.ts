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
export { DOMAIN_STATUSES } from "@/lib/status/statusDomains";

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
  | "anticipo_proveedor"  // QW6 — Anticipos a proveedores
  | "cfdi"                // v13.681.0 — CFDI (factura/NC/REP): borrador→cancelada
  | "conciliacion"         // v13.681.0 — Conciliación bancaria en Tesorería
  | "conciliacion_costo"  // v13.571.0 — Costeado vs facturado por el proveedor
  | "pago_tipo"           // Ola E · V-2 — libro de pagos: cobro/pago/anticipo
  | "rep"                 // Ola E · V-2 — REP: Timbrado/Cancelado/Pendiente
  | "carta_garantia"      // Ola 2 · RN-3 — Carta de garantía de la naviera
  | "tarifa_marcador"     // Ola 2 · RN-3 — Marcadores de fila: Mejor / Nueva
  | "sat_uuid";           // Ola 2 · RN-3 — Estatus del UUID en el SAT

export interface StatusVisual {
  label: string;
  badgeClass: string;
  icon?: LucideIcon;
}

/** Overrides por dominio cuando el mismo string necesita otro label. */
const LABEL_OVERRIDES: Partial<Record<StatusDomain, Record<string, string>>> = {
  anticipo_proveedor: {
    disponible: "Disponible",
    aplicado_parcial: "Aplicado parcial",
    aplicado_total: "Aplicado total",
    cancelado: "Cancelado",
  },
  cfdi: {
    borrador: "Borrador",
    aprobada: "Aprobada",
    timbrada: "Timbrada",
    aplicada: "Aplicada",
    cancelada: "Cancelada",
  },
  proforma: {
    pendiente: "Pendiente cliente",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    facturada: "Facturada",
  },
  pago_tipo: { cobro: "Cobro", pago: "Pago", anticipo: "Anticipo" },
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
