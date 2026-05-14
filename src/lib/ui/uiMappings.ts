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

/** Etiquetas legibles para roles internos del sistema. */
export const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operador: "Operador",
  viewer: "Visor",
  cliente: "Cliente",
};

export const getRoleLabel = (role: string): string => roleLabels[role] ?? role;

/** Color del bullet de timeline para una nota según su tipo. */
export const getNotaTipoColorClass = (tipo: string): string => {
  if (tipo === "cambio_estado") return "bg-accent";
  if (tipo === "nota") return "bg-warning";
  return "bg-muted-foreground";
};

/** Color del indicador de estado de un documento de embarque. */
export const getDocEstadoColorClass = (estado: string): string => {
  if (estado === "Validado" || estado === "Recibido") return "bg-success";
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

/** Color de texto para % de margen de profit (negativo, bajo, sano). */
export const getProfitToneClass = (margenPct: number): string => {
  if (margenPct < 0) return "text-destructive";
  if (margenPct < 10) return "text-warning";
  return "text-success";
};
