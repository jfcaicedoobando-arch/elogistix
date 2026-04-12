/**
 * Mapeos de UI: colores de estado e iconos de modo de transporte.
 * Separados de helpers.ts (utilidades puras de formateo).
 */

import { Anchor, Plane, Truck, Ship } from "lucide-react";
import type { ReactNode } from "react";

export const getEstadoColor = (estado: string): string => {
  const colors: Record<string, string> = {
    'Confirmado': 'bg-info/15 text-info border border-info/30',
    'En Tránsito': 'bg-warning/15 text-warning border border-warning/30',
    'Arribo': 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30',
    'En Aduana': 'bg-violet-500/15 text-violet-600 border border-violet-500/30',
    'Entregado': 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
    'EIR': 'bg-orange-500/15 text-orange-600 border border-orange-500/30',
    'Cerrado': 'bg-muted text-muted-foreground border border-border',
    'Cancelado': 'bg-destructive/15 text-destructive border border-destructive/30',
    // Estados de facturación
    'Borrador': 'bg-muted text-muted-foreground border border-border',
    'Emitida': 'bg-info/15 text-info border border-info/30',
    'Pagada': 'bg-success/15 text-success border border-success/30',
    'Vencida': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Cancelada': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Pendiente': 'bg-warning/15 text-warning border border-warning/30',
    'Recibido': 'bg-info/15 text-info border border-info/30',
    'Validado': 'bg-success/15 text-success border border-success/30',
    'Pagado': 'bg-success/15 text-success border border-success/30',
    // Estados de cotización
    'Enviada': 'bg-info/15 text-info border border-info/30',
    'Aceptada': 'bg-warning/15 text-warning border border-warning/30',
    'Confirmada': 'bg-success/15 text-success border border-success/30',
    'Rechazada': 'bg-destructive/15 text-destructive border border-destructive/30',
    'Embarcada': 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30',
  };
  return colors[estado] || 'bg-muted text-muted-foreground border border-border';
};

export const getModoIcon = (modo: string): string => {
  const icons: Record<string, string> = {
    'Marítimo': '🚢',
    'Aéreo': '✈️',
    'Terrestre': '🚛',
    'Multimodal': '🔄',
  };
  return icons[modo] || '📦';
};

/** Borde izquierdo de color por estado (para tarjetas de embarque) */
export const getEstadoBorderColor = (estado: string): string => {
  const map: Record<string, string> = {
    "Confirmado": "border-l-blue-500",
    "En Tránsito": "border-l-amber-500",
    "Arribo": "border-l-cyan-500",
    "En Aduana": "border-l-violet-500",
    "Entregado": "border-l-emerald-500",
    "EIR": "border-l-orange-500",
    "Cerrado": "border-l-muted-foreground",
    "Cancelado": "border-l-destructive",
  };
  return map[estado] || "border-l-muted-foreground";
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

/** Icono Lucide por modo de transporte (devuelve ReactNode) */
export const getModoLucideIcon = (modo: string): ReactNode => {
  switch (modo) {
    case "Marítimo": return Anchor;
    case "Aéreo": return Plane;
    case "Terrestre": return Truck;
    default: return Ship;
  }
};
