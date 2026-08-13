/**
 * Encabezado del detalle de proveedor (título, badges y acciones).
 * Vive aparte para respetar el límite de 200 líneas de la ruta.
 */
import { Truck, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailHeader } from "@/components/shared/DetailHeader";
import type { Tables } from "@/types/db";
import { ProveedorCsfUpdateButton } from "./ProveedorCsfUpdateButton";

interface Props {
  proveedor: Tables<"proveedores">;
  nombreFmt: string;
  rfcFmt: string;
  esNacional: boolean;
  categoriaLabel: string;
  volver: string | number | null | (() => void);
  canEdit: boolean;
  isAdmin: boolean;
  isDeleting: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onUpdate: (id: string, patch: Record<string, string>) => Promise<unknown>;
}

export function ProveedorDetalleHeader({
  proveedor, nombreFmt, rfcFmt, esNacional, categoriaLabel, volver,
  canEdit, isAdmin, isDeleting, onEditar, onEliminar, onUpdate,
}: Props) {
  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Proveedores"
      icon={<Truck className="h-6 w-6 text-accent shrink-0" />}
      title={nombreFmt}
      subtitle={rfcFmt ? `RFC / Tax ID · ${rfcFmt}` : undefined}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{categoriaLabel}</Badge>
          <Badge variant="outline" className="font-normal">
            {esNacional ? "Nacional" : "Extranjero"}
          </Badge>
        </div>
      }
      trailing={canEdit ? (
        <>
          <Button size="sm" onClick={onEditar}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          {esNacional && (
            <ProveedorCsfUpdateButton proveedor={proveedor} onUpdate={onUpdate} />
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Más acciones del proveedor ${nombreFmt}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={onEliminar}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      ) : undefined}
    />
  );
}
