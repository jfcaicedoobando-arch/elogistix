/**
 * Definición de columnas y tarjeta móvil de la tabla en `AgenteGarantias`.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { CartaGarantiaBadge } from "@/components/shared/CartaGarantiaBadge";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Settings2 } from "lucide-react";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

export function useAgenteGarantiasColumns(
  onConfigurar: (fila: FilaNaviera) => void,
): ColumnDef<FilaNaviera, unknown>[] {
  return useMemo(
    () =>
      defineColumns<FilaNaviera>([
        {
          id: "naviera",
          header: "Naviera",
          accessorFn: (f) => f.naviera_nombre,
          sortingFn: sortByString((f) => f.naviera_nombre),
          enableSorting: true,
          meta: { sticky: true, className: "font-medium" },
          cell: ({ row }) => row.original.naviera_nombre,
        },
        {
          id: "scac",
          header: "SCAC",
          accessorFn: (f) => f.naviera_code,
          meta: { className: "font-mono text-xs", width: COL_W.fecha },
          cell: ({ row }) => row.original.naviera_code,
        },
        {
          id: "carta",
          header: "Carta garantía",
          cell: ({ row }) => (
            <CartaGarantiaBadge
              tieneCarta={row.original.condicion?.tiene_carta_garantia ?? false}
              vigenteHasta={row.original.condicion?.carta_garantia_vigente_hasta ?? null}
            />
          ),
        },
        {
          id: "diaslibres",
          header: "Días libres",
          accessorFn: (f) => f.condicion?.dias_libres_demoras_default ?? null,
          sortingFn: sortByNumber((f) => f.condicion?.dias_libres_demoras_default ?? null),
          enableSorting: true,
          meta: { align: "right", className: "tabular-nums" },
          cell: ({ row }) => row.original.condicion?.dias_libres_demoras_default ?? "—",
        },
        {
          id: "acciones",
          header: "Acciones",
          meta: { width: "w-32", align: "right" },
          cell: ({ row }) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => onConfigurar(row.original)}>
                <Settings2 className="h-4 w-4 mr-1" /> Configurar
              </Button>
            </div>
          ),
        },
      ]),
    [onConfigurar],
  );
}

interface AgenteGarantiaMobileCardProps {
  fila: FilaNaviera;
  onConfigurar: (fila: FilaNaviera) => void;
}

export function AgenteGarantiaMobileCard({ fila, onConfigurar }: AgenteGarantiaMobileCardProps) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium text-body truncate">{fila.naviera_nombre}</div>
        <div className="text-label text-muted-foreground font-mono">{fila.naviera_code}</div>
        <CartaGarantiaBadge
          tieneCarta={fila.condicion?.tiene_carta_garantia ?? false}
          vigenteHasta={fila.condicion?.carta_garantia_vigente_hasta ?? null}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onConfigurar(fila);
        }}
      >
        <Settings2 className="h-4 w-4 mr-1" /> Configurar
      </Button>
    </div>
  );
}
