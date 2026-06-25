/**
 * Estado vacío de la matriz de tarifas marítimas.
 * v13.135.48
 */
import { Button } from "@/components/ui/button";
import { Inbox, Plus, RotateCcw } from "lucide-react";

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNueva: () => void;
}

export function TarifasEmptyState({ hasActiveFilters, onClearFilters, onNueva }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
      <div className="size-14 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          {hasActiveFilters ? "No hay tarifas con los filtros aplicados" : "Aún no hay tarifas marítimas"}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Prueba quitar filtros o capturar una nueva tarifa."
            : "Captura tu primera tarifa para empezar a comparar agentes y rutas."}
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <RotateCcw className="size-4 mr-2" />Limpiar filtros
          </Button>
        )}
        <Button size="sm" onClick={onNueva}>
          <Plus className="size-4 mr-2" />Nueva(s) tarifa(s)
        </Button>
      </div>
    </div>
  );
}
