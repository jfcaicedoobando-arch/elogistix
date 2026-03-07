import { Anchor, Ship, Warehouse, PackageCheck } from "lucide-react";
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
  "En Aduana": {
    icon: Warehouse,
    gradient: "from-destructive to-destructive/80",
    border: "border-destructive",
    text: "text-destructive",
    glow: "shadow-[0_0_20px_hsl(var(--destructive)/0.25)]",
  },
  Entregado: {
    icon: PackageCheck,
    gradient: "from-success to-success/80",
    border: "border-success",
    text: "text-success",
    glow: "shadow-[0_0_20px_hsl(var(--success)/0.25)]",
  },
};
