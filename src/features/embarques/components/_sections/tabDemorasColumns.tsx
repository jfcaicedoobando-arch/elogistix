/**
 * Columnas para `TabDemoras` — extraídas en v13.182.0 (Wave 2 splits).
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { Save } from "lucide-react";
import type { EmbarqueContenedor } from "@/features/embarques/types/contenedor";

export interface DraftPatch {
  fecha_descarga?: string | null;
  fecha_devolucion?: string | null;
  dias_libres_override?: number | null;
}

export interface EditableRow extends EmbarqueContenedor {
  // SAFE-CAST: columnas nuevas (13.66.11) aún no regeneradas en supabase/types.ts.
  fecha_descarga: string | null;
  fecha_devolucion: string | null;
  dias_libres_override: number | null;
}

export interface DemorasColumnsDeps {
  canEdit: boolean;
  drafts: Record<string, DraftPatch>;
  isPending: boolean;
  valorActual: <K extends keyof DraftPatch>(row: EditableRow, field: K) => DraftPatch[K];
  setDraft: (id: string, patch: DraftPatch) => void;
  guardar: (id: string) => void;
}

export function buildDemorasColumns(deps: DemorasColumnsDeps): ColumnDef<EditableRow, unknown>[] {
  const { canEdit, drafts, isPending, valorActual, setDraft, guardar } = deps;
  return defineColumns<EditableRow>([
    {
      id: "cont",
      header: "Contenedor",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm">
            {row.original.numero_contenedor || `#${row.original.orden}`}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.tipo_contenedor}</span>
        </div>
      ),
    },
    {
      id: "f_desc",
      header: "Fecha de descarga",
      cell: ({ row }) => (
        <DatePickerMx
          value={(valorActual(row.original, "fecha_descarga") as string | null) ?? ""}
          onChange={(v) => setDraft(row.original.id, { fecha_descarga: v || null })}
          className="h-8 w-[160px]"
        />
      ),
    },
    {
      id: "f_dev",
      header: "Fecha de devolución",
      cell: ({ row }) => (
        <DatePickerMx
          value={(valorActual(row.original, "fecha_devolucion") as string | null) ?? ""}
          onChange={(v) => setDraft(row.original.id, { fecha_devolucion: v || null })}
          className="h-8 w-[160px]"
        />
      ),
    },
    {
      id: "dias_libres",
      header: "Días libres (override)",
      meta: { align: "right" },
      cell: ({ row }) => (
        <Input
          type="number"
          min={0}
          disabled={!canEdit}
          placeholder="usa naviera"
          title="Vacío = usa los días libres configurados en la naviera. Capturá un número para sobreescribir."
          className="h-8 w-[120px] tabular-nums text-right placeholder:italic placeholder:text-muted-foreground/60"
          value={(valorActual(row.original, "dias_libres_override") as number | null) ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(row.original.id, {
              dias_libres_override: raw === "" ? null : Number(raw),
            });
          }}
        />
      ),
    },
    {
      id: "save",
      header: "",
      cell: ({ row }) => {
        const hasDraft = !!drafts[row.original.id];
        return (
          <Button
            size="sm"
            variant={hasDraft ? "default" : "ghost"}
            disabled={!hasDraft || isPending || !canEdit}
            onClick={() => guardar(row.original.id)}
          >
            <Save className="size-3 mr-1" />
            Guardar
          </Button>
        );
      },
    },
  ]);
}
