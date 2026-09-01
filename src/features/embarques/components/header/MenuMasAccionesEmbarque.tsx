/**
 * Menú "Más acciones" del encabezado de Embarque (compartir tracking,
 * duplicar, cancelar, eliminar).
 *
 * Extraído de `EmbarqueDetalleHeaderActions.tsx` para respetar el límite de
 * 200 líneas por archivo y la complejidad máxima del componente raíz.
 */
import { Trash2, Share2, Copy, MoreHorizontal, Ban, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Lint (complejidad): menú "Más acciones" extraído del componente raíz. */
export function MenuMasAccionesEmbarque(props: {
  trackingPending: boolean;
  tieneLinkActivo: boolean;
  puedeCancelar: boolean;
  puedeEliminar: boolean;
  esTerminal: boolean;
  canEliminarEmbarque: boolean;
  onCompartirTracking: () => void;
  onRevocarTracking: () => void;
  onAbrirDuplicar: () => void;
  onAbrirEliminar: () => void;
  onPedirCancelar: () => void;
}) {
  const {
    trackingPending, tieneLinkActivo, puedeCancelar, puedeEliminar, esTerminal, canEliminarEmbarque,
    onCompartirTracking, onRevocarTracking, onAbrirDuplicar, onAbrirEliminar, onPedirCancelar,
  } = props;
  return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Más acciones" className="h-9 w-9 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onCompartirTracking();
              }}
              disabled={trackingPending}
            >
              <Share2 className="h-4 w-4 mr-2" /> Compartir tracking
            </DropdownMenuItem>
            {tieneLinkActivo && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onRevocarTracking();
                }}
                disabled={trackingPending}
              >
                <Link2Off className="h-4 w-4 mr-2" /> Revocar liga de tracking
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAbrirDuplicar();
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicar embarque
            </DropdownMenuItem>
            {puedeCancelar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onPedirCancelar();
                  }}
                  className="text-warning focus:text-warning focus:bg-warning/10"
                >
                  <Ban className="h-4 w-4 mr-2" /> Cancelar embarque
                </DropdownMenuItem>
              </>
            )}
            {puedeEliminar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onAbrirEliminar();
                  }}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </DropdownMenuItem>
              </>
            )}
            {!esTerminal && !puedeEliminar && canEliminarEmbarque && (
              <div className="px-2 py-1.5 text-label text-muted-foreground">
                Eliminar deshabilitado: hay CxC/CxP pendientes.
              </div>
            )}
            {esTerminal && canEliminarEmbarque && (
              <div className="px-2 py-1.5 text-label text-muted-foreground">
                Eliminar no disponible: el embarque está Cerrado o Cancelado.
              </div>
            )}
            {!canEliminarEmbarque && (
              <div className="px-2 py-1.5 text-label text-muted-foreground">
                Tu rol no permite eliminar embarques.
              </div>
            )}

          </DropdownMenuContent>
        </DropdownMenu>
  );
}

