/**
 * Menú de acciones por fila (kebab) para tarifas marítimas.
 * v13.135.49: consolida editar/duplicar/aprobar/rechazar/reactivar/eliminar.
 */
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, Copy, MoreHorizontal, Pencil, RotateCcw, Trash2, X } from "lucide-react";

interface Props {
  estadoAprobacion: string;
  onEditar: () => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  onAprobar?: () => void;
  onRechazar?: () => void;
  onReactivar?: () => void;
  disabled?: boolean;
  /**
   * P2 (auditoría v13.823.143 · bug 6): con vigencia vencida la aprobación
   * siempre falla en backend. En vez de ofrecerla, se muestra la ruta útil
   * (Editar para actualizar la vigencia).
   */
  vencida?: boolean;
}

export function TarifaRowActions(p: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Acciones de tarifa" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {p.estadoAprobacion === "borrador" && p.vencida && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Vigencia vencida: actualízala en Editar para poder aprobarla.
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {p.estadoAprobacion === "borrador" && !p.vencida && (
          <>
            <DropdownMenuItem onClick={p.onAprobar} disabled={p.disabled} className="text-success focus:text-success">
              <Check className="size-4 mr-2" />Aprobar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={p.onRechazar} disabled={p.disabled} className="text-destructive focus:text-destructive">
              <X className="size-4 mr-2" />Rechazar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {p.estadoAprobacion === "rechazada" && (
          <>
            <DropdownMenuItem onClick={p.onReactivar} disabled={p.disabled}>
              <RotateCcw className="size-4 mr-2" />Reactivar como borrador
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={p.onEditar}>
          <Pencil className="size-4 mr-2" />Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={p.onDuplicar}>
          <Copy className="size-4 mr-2" />Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={p.onEliminar} className="text-destructive focus:text-destructive">
          <Trash2 className="size-4 mr-2" />Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
