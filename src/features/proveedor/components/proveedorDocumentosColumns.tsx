/**
 * Ola 3 — Columnas del expediente documental del proveedor.
 * Vive aparte de la tabla para respetar el límite de 200 líneas.
 */
import { Download, Trash2 } from "lucide-react";
import type { ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import {
  estadoVigencia,
  formatTamano,
  type DocumentoProveedor,
  type EstadoVigencia,
} from "@/features/proveedor/domain/documentosProveedor";

const TONO_VIGENCIA: Record<EstadoVigencia, string> = {
  Vigente: "bg-success/15 text-success border-success/30",
  "Por vencer": "bg-warning/15 text-warning border-warning/30",
  Vencido: "bg-destructive/15 text-destructive border-destructive/30",
  "Sin vigencia": "bg-muted text-muted-foreground border-border",
};

interface Acciones {
  onDescargar: (doc: DocumentoProveedor) => void;
  onEliminar?: (doc: DocumentoProveedor) => void;
}

export function documentosProveedorColumns<T extends DocumentoProveedor>(
  acciones: Acciones,
): ColumnDef<T, unknown>[] {
  return [
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (d) => d.tipo,
      enableSorting: true,
      cell: ({ row }) => <span className="font-medium">{row.original.tipo}</span>,
    },
    {
      id: "nombre",
      header: "Archivo",
      accessorFn: (d) => d.nombre,
      cell: ({ row }) => (
        <span className="block max-w-[22rem] truncate" title={row.original.nombre}>
          {row.original.nombre}
        </span>
      ),
    },
    {
      id: "fecha_documento",
      header: "Fecha",
      accessorFn: (d) => d.fecha_documento ?? "",
      enableSorting: true,
      meta: { width: COL_W.fecha },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.fecha_documento ? formatDate(row.original.fecha_documento) : "—"}
        </span>
      ),
    },
    {
      id: "vigencia",
      header: "Vigencia",
      accessorFn: (d) => d.fecha_vencimiento ?? "",
      cell: ({ row }) => {
        const estado = estadoVigencia(row.original.fecha_vencimiento);
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className={TONO_VIGENCIA[estado]}>{estado}</Badge>
            {row.original.fecha_vencimiento && (
              <span className="text-2xs text-muted-foreground tabular-nums">
                {formatDate(row.original.fecha_vencimiento)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "tamano",
      header: "Tamaño",
      accessorFn: (d) => d.tamano_bytes ?? 0,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatTamano(row.original.tamano_bytes)}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Descargar ${row.original.nombre}`}
            onClick={(e) => { e.stopPropagation(); acciones.onDescargar(row.original); }}
          >
            <Download className="h-4 w-4" />
          </Button>
          {acciones.onEliminar && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${row.original.nombre}`}
              className="text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); acciones.onEliminar?.(row.original); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
