/**
 * v13.545.0 — Definición de las tarjetas del panel de alertas de embarques.
 * Extraído de `EmbarquesAlertasPanel.tsx` para respetar el límite de líneas.
 *
 * Colores en tokens semánticos (`warning` / `destructive`), nunca escalas
 * Tailwind hardcodeadas.
 */
import { Clock, ShieldAlert, FileWarning, PackageCheck, type LucideIcon } from "lucide-react";
import type { EmbarqueAlertaFiltro } from "@/features/embarques/hooks/useEmbarquesFilters";

export interface AlertaTileDef {
  key: Exclude<EmbarqueAlertaFiltro, "todos">;
  titulo: string;
  descripcion: string;
  Icon: LucideIcon;
  color: string;
}

export const ALERTAS_TILES: readonly AlertaTileDef[] = [
  {
    key: "demora",
    titulo: "Demoras",
    descripcion: "Embarques en puerto con +7 días sin liberación.",
    Icon: Clock,
    color: "text-warning bg-warning/15",
  },
  {
    key: "garantia",
    titulo: "Garantías atoradas",
    descripcion: "Depósitos de contenedor con +30 días sin liberar.",
    Icon: ShieldAlert,
    color: "text-warning bg-warning/15",
  },
  {
    key: "cierre_operativo",
    titulo: "Cierre operativo",
    descripcion: "Entregado / EIR con documentos, CxC o CxP pendientes.",
    Icon: PackageCheck,
    color: "text-warning bg-warning/15",
  },
  {
    key: "admin_pendiente",
    titulo: "Cierre administrativo",
    descripcion: "Por liquidar: falta cobrar al cliente o pagar al proveedor.",
    Icon: FileWarning,
    color: "text-destructive bg-destructive/10",
  },
];
