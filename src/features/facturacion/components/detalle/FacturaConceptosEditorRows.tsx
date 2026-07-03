/**
 * Renglones (visualización + formulario) del editor de conceptos de factura.
 * Extraído de FacturaConceptosEditor para respetar el límite de 200 líneas.
 */
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type {
  ConceptoFacturaInput,
  ConceptoFacturaRow,
  TipoIvaConcepto,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

const TIPO_IVA_LABEL: Record<TipoIvaConcepto, string> = {
  gravado_16: "IVA 16%",
  tasa_0: "Tasa 0%",
  exento: "Exento",
};

const TIPO_IVA_SHORT: Record<TipoIvaConcepto, string> = {
  gravado_16: "16%",
  tasa_0: "0%",
  exento: "Exento",
};

function IvaBadge({ tipo }: { tipo: TipoIvaConcepto }) {
  const variant: "default" | "secondary" | "outline" =
    tipo === "gravado_16" ? "default" : tipo === "tasa_0" ? "secondary" : "outline";
  return <Badge variant={variant}>{TIPO_IVA_SHORT[tipo]}</Badge>;
}

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
      <div className="col-span-4 truncate">
        <p className="text-sm font-medium truncate">{row.descripcion}</p>
        <p className="text-xs text-muted-foreground font-mono">SAT {row.clave_sat}</p>
      </div>
      <div className="col-span-1 text-right text-sm">{row.cantidad}</div>
      <div className="col-span-2 text-right text-sm tabular-nums">{formatCurrency(row.precio_unitario, moneda)}</div>
      <div className="col-span-1 flex justify-center"><IvaBadge tipo={row.tipo_iva} /></div>
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
  const tipoIva: TipoIvaConcepto = draft.tipo_iva ?? "gravado_16";
  return (
    <div className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/30">
      <div className="col-span-4">
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
      <div className="col-span-2">
        <Label className="text-xs">IVA</Label>
        <Select value={tipoIva} onValueChange={(v) => patch({ tipo_iva: v as TipoIvaConcepto })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gravado_16">{TIPO_IVA_LABEL.gravado_16}</SelectItem>
            <SelectItem value="tasa_0">{TIPO_IVA_LABEL.tasa_0}</SelectItem>
            <SelectItem value="exento">{TIPO_IVA_LABEL.exento}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1 flex justify-end gap-1">
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
