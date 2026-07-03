/**
 * @deprecated Usar `actionsColumn` de `@/components/shared/dataTable/columnBuilders`.
 * Conservado por compatibilidad mientras se migra `cotizacionesColumns.tsx`.
 */
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";

export interface AccionesParams {
  onEditar: (id: string) => void;
  onEliminar: (id: string) => void;
}

/** @deprecated Usar `actionsColumn` del columnBuilders compartido. */
export function renderAcciones(r: CotizacionListItem, params: AccionesParams) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones de la cotización">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); params.onEditar(r.id); }}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => { e.stopPropagation(); params.onEliminar(r.id); }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
