/**
 * Estado vacío de la matriz de tarifas marítimas.
 * v13.435.0 — usa el `EmptyState` compartido (patrón único de listados).
 * P2-A2: con `?ruta=` el vacío habla de esa ruta, no de todo el catálogo.
 */
import EmptyState from "@/components/empty/EmptyState";
import { Inbox } from "lucide-react";

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNueva: () => void;
  /** Ruta filtrada desde el URL (si aplica). */
  rutaLabel?: string;
}

function textos(hasActiveFilters: boolean, rutaLabel?: string) {
  if (rutaLabel) {
    return {
      title: `La ruta ${rutaLabel} no tiene tarifas con estos filtros`,
      description: "Captura una tarifa para esta ruta o limpia los filtros para ver todo el catálogo.",
    };
  }
  if (hasActiveFilters) {
    return { title: "No hay tarifas con los filtros aplicados", description: "Prueba quitar filtros o capturar una nueva tarifa." };
  }
  return { title: "Aún no hay tarifas marítimas", description: "Captura tu primera tarifa para empezar a comparar agentes y rutas." };
}

export function TarifasEmptyState({ hasActiveFilters, onClearFilters, onNueva, rutaLabel }: Props) {
  const t = textos(hasActiveFilters, rutaLabel);
  return (
    <EmptyState
      icon={Inbox}
      title={t.title}
      description={t.description}
      primaryAction={{ label: rutaLabel ? "Nueva tarifa para esta ruta" : "Nueva(s) tarifa(s)", onClick: onNueva }}
      secondaryAction={
        hasActiveFilters ? { label: "Limpiar filtros", onClick: onClearFilters, variant: "outline" } : undefined
      }
    />
  );
}
