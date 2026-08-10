/**
 * Columna de selección (checkbox por fila + master en el header) para
 * aprobación en lote de facturas de proveedor. Extraído de
 * `ComprasPorAprobar.tsx` para respetar el límite de 200 líneas.
 */
import { Checkbox } from "@/components/ui/checkbox";
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
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            {bloqueada ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>{checkbox}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {motivoBloqueo ?? "No puedes aprobar esta factura."}
                </TooltipContent>
              </Tooltip>
            ) : (
              checkbox
            )}
          </div>
        );
      },
      meta: { align: "center" },
      size: 40,
    },
  ])[0];
}
