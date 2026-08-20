/**
 * Mapeos de UI: helpers de estado e iconos de modo de transporte.
 *
 * Los mapeos de estado están centralizados en `estadoConfig.ts` (fuente única de verdad).
 * Este archivo expone wrappers ligeros para mantener la API pública estable.
 *
 * UI-3 (v13.683.0): `getEstadoColor` fue ELIMINADO. El único componente para
 * badges de estado es `StatusBadge` (`src/components/shared/StatusBadge.tsx`),
 * que consume `statusRegistry`/`estadoConfig`. Para casos sin componente, usa
 * `getEstadoVisual(estado).badge` de `./estadoConfig`.
 */

import type { LucideIcon } from "lucide-react";
import { Anchor, Plane, Truck, Ship } from "lucide-react";
import { getEstadoVisual } from "./estadoConfig";

/** Borde izquierdo de color por estado (para tarjetas de embarque) */
export const getEstadoBorderColor = (estado: string): string =>
  getEstadoVisual(estado).borderLeft;

/** Color de fondo para barras apiladas por estado */
export const getEstadoBarColor = (estado: string): string =>
  getEstadoVisual(estado).bar;

/** Estilo de círculo por modo de transporte */
export const getModoCircleStyle = (modo: string): string => {
  const map: Record<string, string> = {
    "Marítimo": "bg-info/15 text-info",
    "Aéreo": "bg-mode-aereo-soft text-mode-aereo",
    "Terrestre": "bg-warning/15 text-warning dark:bg-warning/20",
    "Multimodal": "bg-mode-multimodal-soft text-mode-multimodal",
  };
  return map[modo] || "bg-muted text-muted-foreground";
};

/** Icono Lucide por modo de transporte (devuelve componente) */
export const getModoLucideIcon = (modo: string): LucideIcon => {
  switch (modo) {
    case "Marítimo": return Anchor;
    case "Aéreo": return Plane;
    case "Terrestre": return Truck;
    default: return Ship;
  }
};

/** Etiquetas legibles para roles internos del sistema.
 *  @deprecated Importar `ROLE_LABELS` / `obtenerEtiquetaRol` desde `@/features/admin/domain/roles/roleCatalog`. */
export {  obtenerEtiquetaRol } from "@/features/admin/domain/roles/roleCatalog";


/** Color del indicador de estado de un documento de embarque. */
export const getDocEstadoColorClass = (estado: string): string => {
  if (estado === "Validado" || estado === "Recibido") return "bg-success";
  if (estado === "No aplica") return "bg-muted-foreground/40";
  return "bg-destructive";
};

/** Clases del círculo numerado del StepIndicator del wizard. */
export const getStepIndicatorCircleClass = (
  currentStep: number,
  stepNum: number,
): string => {
  if (currentStep > stepNum) return "bg-success text-success-foreground";
  if (currentStep === stepNum) return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
};

/** Tono semántico para días vencidos (umbral 30/15). */
export type SemanticTone = "destructive" | "warning" | "default";
export const getDiasVencidosTone = (dias: number): SemanticTone => {
  if (dias > 30) return "destructive";
  if (dias > 15) return "warning";
  return "default";
};

/* Ola 5 · 5.6: `getProfitToneClass` fue ELIMINADO. Usa `claseTonoMargen` /
 * `<MargenBadge />` (`@/lib/ui/margen`, `@/components/shared/MargenBadge`). */
