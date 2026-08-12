import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";

interface Props {
  onLimpiar: () => void;
}

/**
 * UIA-15: estado vacío accionable del listado de embarques. Antes sólo decía
 * "No se encontraron embarques" y el usuario tenía que deshacer a mano cada
 * filtro para volver a ver datos.
 */
export function EmbarquesTablaVacia({ onLimpiar }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        No encontramos embarques con la búsqueda o los filtros actuales.
      </p>
      <Button variant="outline" size="sm" onClick={onLimpiar}>
        <FilterX className="h-4 w-4 mr-2" /> Limpiar filtros
      </Button>
    </div>
  );
}
