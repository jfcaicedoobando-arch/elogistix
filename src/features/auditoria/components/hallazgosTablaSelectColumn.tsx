/**
 * Columna de checkbox para selección múltiple en la tabla de hallazgos.
 * Aislada para mantener `HallazgosTabla.tsx` bajo el límite de 200 líneas.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { type ColumnDef } from "@/components/shared/DataTable";
import { revisionKey } from "@/features/auditoria/hooks";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export interface SelectColumnArgs {
  revisiones: Map<string, AuditoriaRevision> | undefined;
  selectedIds: Set<string>;
  selectablesEnPagina: string[];
  onToggleSelected: (id: string) => void;
  onToggleAllVisible: () => void;
}

export function buildSelectColumn({
  revisiones,
  selectedIds,
  selectablesEnPagina,
  onToggleSelected,
  onToggleAllVisible,
}: SelectColumnArgs): ColumnDef<HallazgoAuditoria, unknown> {
  const allSelected =
    selectablesEnPagina.length > 0 &&
    selectablesEnPagina.every((id) => selectedIds.has(id));
  const someSelected = selectablesEnPagina.some((id) => selectedIds.has(id));
  const masterState: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  return {
    id: "select",
    header: () => (
      <Checkbox
        checked={masterState}
        onCheckedChange={onToggleAllVisible}
        disabled={selectablesEnPagina.length === 0}
        aria-label="Seleccionar todos los hallazgos pendientes de la página"
      />
    ),
    meta: { width: COL_W.micro },
    cell: ({ row }) => {
      const h = row.original;
      const rev = revisiones?.get(revisionKey(h));
      const yaRevisado = rev?.estado_revision === "revisado";
      const id = revisionKey(h);
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(id)}
            disabled={yaRevisado}
            onCheckedChange={() => onToggleSelected(id)}
            aria-label={`Seleccionar hallazgo ${h.expediente} ${h.regla}`}
          />
        </div>
      );
    },
  };
}
