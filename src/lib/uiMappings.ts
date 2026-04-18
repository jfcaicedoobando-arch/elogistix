/**
 * Mapeos de UI: helpers de estado e iconos de modo de transporte.
 *
 * Los mapeos de estado están centralizados en `estadoConfig.ts` (fuente única de verdad).
 * Este archivo expone wrappers ligeros para mantener la API pública estable.
 */

import type { LucideIcon } from "lucide-react";
import { Anchor, Plane, Truck, Ship } from "lucide-react";
import { getEstadoVisual } from "./estadoConfig";

export const getEstadoColor = (estado: string): string =>
  getEstadoVisual(estado).badge;

/** Borde izquierdo de color por estado (para tarjetas de embarque) */
export const getEstadoBorderColor = (estado: string): string =>
  getEstadoVisual(estado).borderLeft;

/** Color de fondo para barras apiladas por estado */
export const getEstadoBarColor = (estado: string): string =>
  getEstadoVisual(estado).bar;

export const getModoIcon = (modo: string): string => {
  const icons: Record<string, string> = {
    'Marítimo': '🚢',
    'Aéreo': '✈️',
    'Terrestre': '🚛',
    'Multimodal': '🔄',
  };
  return icons[modo] || '📦';
};

/** Estilo de círculo por modo de transporte */
export const getModoCircleStyle = (modo: string): string => {
  const map: Record<string, string> = {
    "Marítimo": "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    "Aéreo": "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    "Terrestre": "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    "Multimodal": "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
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
