import { Anchor, Ship, Container, Warehouse, PackageCheck } from "lucide-react";
import type { DesgloseEstados } from "@/features/operaciones/hooks";

// Tokens semánticos: usamos colores del design system mediante variables CSS
export const ESTADO_COLOR: Record<keyof DesgloseEstados, string> = {
  Confirmado: "hsl(var(--info))",
  "En Tránsito": "hsl(var(--warning))",
  Llegada: "hsl(var(--state-llegada))",
  "En Proceso": "hsl(var(--state-en-proceso))",
  Cerrado: "hsl(var(--state-cerrado))",
};

export const ESTADO_ICON: Record<keyof DesgloseEstados, typeof Anchor> = {
  Confirmado: Anchor,
  "En Tránsito": Ship,
  Llegada: Container,
  "En Proceso": Warehouse,
  Cerrado: PackageCheck,
};

/**
 * P1-1 (R5): el bucket `Cerrado` del RPC agrupa EIR + Por liquidar + Cerrado,
 * así que mostrar la palabra "Cerrado" hacía creer que un embarque `Por liquidar`
 * ya estaba cerrado. La etiqueta visible es "Finalizado".
 */
export const ESTADO_LABEL: Record<keyof DesgloseEstados, string> = {
  Confirmado: "Confirmado",
  "En Tránsito": "En Tránsito",
  Llegada: "Llegada",
  "En Proceso": "En Proceso",
  Cerrado: "Finalizado",
};

/** Detalle de qué estados reales agrupa cada bucket (para tooltips). */
export const ESTADO_TOOLTIP: Partial<Record<keyof DesgloseEstados, string>> = {
  Cerrado: "Incluye EIR, Por liquidar y Cerrado",
};
