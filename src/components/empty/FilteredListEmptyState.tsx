import { Inbox, SearchX, type LucideIcon } from "lucide-react";
import { EmptyStateInline } from "./EmptyStateInline";

interface Props {
  filtered: boolean;
  onClearFilters: () => void;
  message: string;
  hint?: string;
  filteredHint?: string;
  icon?: LucideIcon;
}

/** Vacío de una consulta exitosa: distingue filtros activos del cero de su alcance. */
export function FilteredListEmptyState({
  filtered, onClearFilters, message, hint, filteredHint, icon = Inbox,
}: Props) {
  return (
    <EmptyStateInline
      icon={filtered ? SearchX : icon}
      message={filtered ? "No hay resultados con los filtros actuales." : message}
      hint={filtered
        ? filteredHint ?? "Prueba otra búsqueda o limpia los filtros para ver los registros disponibles."
        : hint}
      action={filtered ? { label: "Limpiar filtros", onClick: onClearFilters } : undefined}
      className="py-10"
    />
  );
}
