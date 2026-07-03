/**
 * Renglones (visualización + formulario) del editor de conceptos de factura.
 * Extraído de FacturaConceptosEditor para respetar el límite de 200 líneas.
 */
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import type {
  ConceptoFacturaInput,
  ConceptoFacturaRow,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

interface RowProps {
  row: ConceptoFacturaRow;
  moneda: Moneda;
  isEditing: boolean;
  draft: ConceptoFacturaInput;
  setDraft: (d: ConceptoFacturaInput) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  busy: boolean;
}

export function ConceptoRow({
  row, moneda, isEditing, draft, setDraft, onStartEdit, onCancelEdit, onSave, onDelete, busy,
}: RowProps) {
  if (isEditing) {
    return <FormRow draft={draft} setDraft={setDraft} onCancel={onCancelEdit} onSave={onSave} busy={busy} />;
  }
  return (
    <div className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
      <div className="col-span-5 truncate">
        <p className="text-sm font-medium truncate">{row.descripcion}</p>
        <p className="text-xs text-muted-foreground font-mono">SAT {row.clave_sat}</p>
      </div>
      <div className="col-span-1 text-right text-sm">{row.cantidad}</div>
      <div className="col-span-2 text-right text-sm tabular-nums">{formatCurrency(row.precio_unitario, moneda)}</div>
      <div className="col-span-2 text-right text-sm tabular-nums font-medium">{formatCurrency(row.total, moneda)}</div>
      <div className="col-span-2 flex justify-end gap-1">
        <Button size="icon" variant="ghost" onClick={onStartEdit} disabled={busy} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} disabled={busy} aria-label="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface FormProps {
  draft: ConceptoFacturaInput;
  setDraft: (d: ConceptoFacturaInput) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}

export function FormRow({ draft, setDraft, onCancel, onSave, busy }: FormProps) {
  const patch = (p: Partial<ConceptoFacturaInput>) => setDraft({ ...draft, ...p });
  return (
    <div className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/30">
      <div className="col-span-5">
        <Label className="text-xs">Descripción</Label>
        <Input value={draft.descripcion} onChange={(e) => patch({ descripcion: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Clave SAT</Label>
        <Input value={draft.clave_sat ?? ""} onChange={(e) => patch({ clave_sat: e.target.value })} />
      </div>
      <div className="col-span-1">
        <Label className="text-xs">Cant.</Label>
        <Input type="number" min={1} value={draft.cantidad} onChange={(e) => patch({ cantidad: Number(e.target.value) || 1 })} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">P. unitario</Label>
        <Input type="number" step="0.01" min={0} value={draft.precio_unitario} onChange={(e) => patch({ precio_unitario: Number(e.target.value) || 0 })} />
      </div>
      <div className="col-span-2 flex justify-end gap-1">
        <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={onSave} disabled={busy || !draft.descripcion.trim()} aria-label="Guardar">
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function NuevoRow(props: FormProps) {
  return <FormRow {...props} />;
}
