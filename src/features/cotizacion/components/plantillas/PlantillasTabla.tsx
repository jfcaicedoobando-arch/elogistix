/**
 * Tabla de plantillas — extraída de `CotizacionPlantillas.tsx` en v13.297.4
 * para respetar el límite `max-lines`.
 */
import { MoreVertical, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/formatters";
import type { CotizacionPlantilla } from "@/features/cotizacion/hooks/useCotizacionPlantillas";

interface Props {
  plantillas: CotizacionPlantilla[];
  onEditar: (p: CotizacionPlantilla) => void;
  onEliminar: (p: CotizacionPlantilla) => void;
  onUsar: (p: CotizacionPlantilla) => void;
}

export function PlantillasTabla({ plantillas, onEditar, onEliminar, onUsar }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground border-b">
          <tr>
            <th className="text-left py-2 px-2">Nombre</th>
            <th className="text-left py-2 px-2">Descripción</th>
            <th className="text-left py-2 px-2">Visibilidad</th>
            <th className="text-right py-2 px-2">Usos</th>
            <th className="text-left py-2 px-2">Actualizada</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {plantillas.map((p, i) => (
            <tr
              key={p.id}
              className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              data-testid={`plantilla-row-${p.id}`}
            >
              <td className="py-2 px-2 font-medium">{p.nombre}</td>
              <td className="py-2 px-2 text-muted-foreground max-w-[280px] truncate">
                {p.descripcion ?? "—"}
              </td>
              <td className="py-2 px-2">
                <Badge variant={p.visibilidad === "org" ? "default" : "secondary"}>
                  {p.visibilidad === "org" ? "Organización" : "Sólo yo"}
                </Badge>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{p.veces_usada}</td>
              <td className="py-2 px-2 text-muted-foreground">
                {formatDate(p.updated_at)}
              </td>
              <td className="py-2 px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Acciones ${p.nombre}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onEditar(p); }}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onUsar(p); }}
                    >
                      <ArrowUpRight className="h-4 w-4 mr-2" /> Usar en cotización
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onEliminar(p); }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
