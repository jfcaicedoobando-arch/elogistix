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

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  plantillas: CotizacionPlantilla[];
  onEditar: (p: CotizacionPlantilla) => void;
  onEliminar: (p: CotizacionPlantilla) => void;
  onUsar: (p: CotizacionPlantilla) => void;
}

export function PlantillasTabla({ plantillas, onEditar, onEliminar, onUsar }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-body">
        <TableHeader className="text-body-sm uppercase text-muted-foreground border-b">
          <TableRow>
            <DetailTableHead>Nombre</DetailTableHead>
            <DetailTableHead>Descripción</DetailTableHead>
            <DetailTableHead>Visibilidad</DetailTableHead>
            <DetailTableHead className="text-right">Usos</DetailTableHead>
            <DetailTableHead>Actualizada</DetailTableHead>
            <DetailTableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {plantillas.map((p, i) => (
            <TableRow key={p.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"} data-testid={`plantilla-row-${p.id}`}>
              <TableCell className="font-medium">{p.nombre}</TableCell>
              <TableCell className="text-muted-foreground max-w-[280px] truncate">
                {p.descripcion ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={p.visibilidad === "org" ? "default" : "secondary"}>
                  {p.visibilidad === "org" ? "Organización" : "Sólo yo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.veces_usada}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(p.updated_at)}
              </TableCell>
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
