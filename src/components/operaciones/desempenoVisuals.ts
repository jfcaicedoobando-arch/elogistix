import { Anchor, Ship, Container, Warehouse, PackageCheck } from "lucide-react";
import type { DesgloseEstados } from "@/hooks/operaciones/useOperacionesData";

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
