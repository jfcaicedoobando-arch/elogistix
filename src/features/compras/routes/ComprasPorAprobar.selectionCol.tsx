/**
 * Columna de selección (checkbox por fila + master en el header) para
 * aprobación en lote de facturas de proveedor. Extraído de
 * `ComprasPorAprobar.tsx` para respetar el límite de 200 líneas.
 */
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { FacturaCxP } from "@/features/cxp/services";

interface Args {
  rows: FacturaCxP[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  /**
   * Ids que este usuario NO puede aprobar (segregación de funciones: capturó
   * él mismo la factura). Se muestran deshabilitados con explicación.
   */
  bloqueados?: Set<string>;
  motivoBloqueo?: string;
}

export function buildSelectionColumn({
  rows, selected, setSelected, bloqueados, motivoBloqueo,
}: Args): ColumnDef<FacturaCxP, unknown> {
  const esBloqueada = (id: string) => Boolean(bloqueados?.has(id));
  const seleccionables = rows.map((r) => r.id).filter((id) => !esBloqueada(id));
  return defineColumns<FacturaCxP>([
    {
      id: "sel",
      header: () => {
        const allSel = seleccionables.length > 0 && seleccionables.every((id) => selected.has(id));
        const someSel = seleccionables.some((id) => selected.has(id));
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            <Checkbox
              aria-label={allSel ? "Deseleccionar todas" : "Seleccionar todas"}
              checked={allSel ? true : someSel ? "indeterminate" : false}
              disabled={seleccionables.length === 0}
              onCheckedChange={(v) => {
                setSelected(() => (v ? new Set(seleccionables) : new Set()));
              }}
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const bloqueada = esBloqueada(row.original.id);
        const checkbox = (
          <Checkbox
            aria-label={`Seleccionar factura ${row.original.folio_proveedor}`}
            checked={selected.has(row.original.id)}
            disabled={bloqueada}
            onCheckedChange={(v) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (v) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
          />
        );
        const motivo = motivoBloqueo ?? "No puedes aprobar esta factura.";
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1">
            {checkbox}
            {bloqueada && (
              // Un checkbox deshabilitado no dispara el Tooltip (pointer-events),
              // así que el motivo vive en un botón enfocable + texto para
              // lectores de pantalla: nunca un checkbox mudo.
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Por qué no se puede aprobar: ${motivo}`}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{motivo}</TooltipContent>
              </Tooltip>
            )}
            {bloqueada && <span className="sr-only">{motivo}</span>}
          </div>
        );
      },
      meta: { align: "center" },
      size: 40,
    },
  ])[0];
}
