/**
 * Estado vacío de la matriz de tarifas marítimas.
 * v13.435.0 — usa el `EmptyState` compartido (patrón único de listados).
 */
import EmptyState from "@/components/empty/EmptyState";
import { Inbox } from "lucide-react";

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNueva: () => void;
}

export function TarifasEmptyState({ hasActiveFilters, onClearFilters, onNueva }: Props) {
  return (
    <EmptyState
      icon={Inbox}
      title={hasActiveFilters ? "No hay tarifas con los filtros aplicados" : "Aún no hay tarifas marítimas"}
      description={
        hasActiveFilters
          ? "Prueba quitar filtros o capturar una nueva tarifa."
          : "Captura tu primera tarifa para empezar a comparar agentes y rutas."
      }
      primaryAction={{ label: "Nueva(s) tarifa(s)", onClick: onNueva }}
      secondaryAction={
        hasActiveFilters ? { label: "Limpiar filtros", onClick: onClearFilters, variant: "outline" } : undefined
      }
    />
  );
}
