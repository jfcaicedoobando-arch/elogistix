import { Anchor, Ship, Warehouse, PackageCheck, Container, FileCheck } from "lucide-react";
import type { EstadoFiltro } from "@/hooks/useDashboardData";

export const ESTADO_CONFIG: Record<
  EstadoFiltro,
  {
    icon: typeof Ship;
    gradient: string;
    border: string;
    text: string;
    glow: string;
  }
> = {
  Confirmado: {
    icon: Anchor,
    gradient: "from-info to-info/80",
    border: "border-info",
    text: "text-info",
    glow: "shadow-[0_0_20px_hsl(var(--info)/0.25)]",
  },
  "En Tránsito": {
    icon: Ship,
    gradient: "from-warning to-warning/80",
    border: "border-warning",
    text: "text-warning",
    glow: "shadow-[0_0_20px_hsl(var(--warning)/0.25)]",
  },
  Arribo: {
    icon: Container,
    gradient: "from-cyan-500 to-cyan-500/80",
    border: "border-cyan-500",
    text: "text-cyan-600",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",
  },
  "En Aduana": {
    icon: Warehouse,
    gradient: "from-violet-500 to-violet-500/80",
    border: "border-violet-500",
    text: "text-violet-600",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]",
  },
  Entregado: {
    icon: PackageCheck,
    gradient: "from-emerald-500 to-emerald-500/80",
    border: "border-emerald-500",
    text: "text-emerald-600",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
  },
};
