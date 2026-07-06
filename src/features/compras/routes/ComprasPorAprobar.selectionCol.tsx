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
}

export function buildSelectionColumn({ rows, selected, setSelected }: Args): ColumnDef<FacturaCxP, unknown> {
  return defineColumns<FacturaCxP>([
    {
      id: "sel",
      header: () => {
        const allIds = rows.map((r) => r.id);
        const allSel = allIds.length > 0 && allIds.every((id) => selected.has(id));
        const someSel = allIds.some((id) => selected.has(id));
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            <Checkbox
              aria-label={allSel ? "Deseleccionar todas" : "Seleccionar todas"}
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) => {
                setSelected(() => (v ? new Set(allIds) : new Set()));
              }}
            />
          </div>
        );
      },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox
            aria-label={`Seleccionar factura ${row.original.folio_proveedor}`}
            checked={selected.has(row.original.id)}
            onCheckedChange={(v) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (v) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
          />
        </div>
      ),
      meta: { align: "center" },
      size: 40,
    },
  ])[0];
}
