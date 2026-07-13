import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { TrashRow } from "@/features/admin/hooks";
import { dtf } from "./tablas";

interface BuildColumnsParams {
  onRestore: (id: string) => void;
  onPurgeTarget: (row: TrashRow) => void;
  isBusy: boolean;
}

export function buildPapeleraColumns({ onRestore, onPurgeTarget, isBusy }: BuildColumnsParams): ColumnDef<TrashRow, unknown>[] {
  return defineColumns<TrashRow>([
    {
      id: "label",
      header: "Registro",
      cell: ({ row }) => <span className="font-medium truncate block max-w-[280px]">{row.original.label}</span>,
    },
    {
      id: "deleted_at",
      header: "Eliminado",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{dtf.format(new Date(row.original.deleted_at))}</span>,
    },
    {
      id: "deleted_by_email",
      header: "Usuario",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {r.deleted_by_email ?? (r.deleted_by ? r.deleted_by.slice(0, 8) : "—")}
          </span>
        );
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      meta: { align: "right" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onRestore(r.id)} disabled={isBusy}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onPurgeTarget(r)} disabled={isBusy}>
              <X className="h-3.5 w-3.5 mr-1" /> Purgar
            </Button>
          </div>
        );
      },
    },
  ]);
}
