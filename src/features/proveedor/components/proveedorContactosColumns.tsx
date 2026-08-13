/**
 * Ola 4 — Columnas de la tabla de contactos del proveedor (archivo aparte para
 * respetar el límite de 200 líneas por componente).
 */
import { Pencil, Trash2, Star } from "lucide-react";
import type { ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/lib/formatters";
import type { ContactoProveedor } from "@/features/proveedor/domain/contactosProveedor";

interface Acciones {
  onEditar?: (c: ContactoProveedor) => void;
  onEliminar?: (c: ContactoProveedor) => void;
}

export function proveedorContactosColumns(
  acciones: Acciones,
): ColumnDef<ContactoProveedor, unknown>[] {
  const columnas: ColumnDef<ContactoProveedor, unknown>[] = [
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (c) => c.nombre,
      enableSorting: true,
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          {row.original.es_principal && (
            <Star className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
          )}
          {toTitleCase(row.original.nombre)}
          {row.original.es_principal && (
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
              Principal
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "puesto",
      header: "Puesto / Área",
      accessorFn: (c) => c.puesto,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {[row.original.puesto, row.original.area].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      id: "email",
      header: "Correo",
      accessorFn: (c) => c.email,
      cell: ({ row }) => <span className="text-xs">{row.original.email || "—"}</span>,
    },
    {
      id: "telefono",
      header: "Teléfono",
      accessorFn: (c) => c.telefono,
      meta: { width: COL_W.short },
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {row.original.telefono || "—"}
          {row.original.extension ? ` ext. ${row.original.extension}` : ""}
        </span>
      ),
    },
  ];

  if (acciones.onEditar || acciones.onEliminar) {
    columnas.push({
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { width: COL_W.short },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {acciones.onEditar && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              aria-label={`Editar contacto ${row.original.nombre}`}
              onClick={(e) => { e.stopPropagation(); acciones.onEditar?.(row.original); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {acciones.onEliminar && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              aria-label={`Eliminar contacto ${row.original.nombre}`}
              onClick={(e) => { e.stopPropagation(); acciones.onEliminar?.(row.original); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    });
  }

  return columnas;
}
