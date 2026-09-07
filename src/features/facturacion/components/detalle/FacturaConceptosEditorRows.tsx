/**
 * Renglones (visualización + formulario) del editor de conceptos de factura.
 * Extraído de FacturaConceptosEditor para respetar el límite de 200 líneas.
 * Ola 3 — incluye captura y despliegue de retenciones ISR/IVA por concepto.
 */
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { RetencionSelects } from "./FacturaConceptosRetencionSelects";
import type {
  ConceptoFacturaInput,
  ConceptoFacturaRow,
  TipoIvaConcepto,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Moneda } from "@/features/facturacion/types";

const TIPO_IVA_LABEL: Record<TipoIvaConcepto, string> = {
  gravado_16: "IVA 16%",
  gravado_8: "IVA 8% (frontera)",
  tasa_0: "Tasa 0%",
  exento: "Exento",
};

const TIPO_IVA_SHORT: Record<TipoIvaConcepto, string> = {
  gravado_16: "16%",
  gravado_8: "8%",
  tasa_0: "0%",
  exento: "Exento",
};

function IvaBadge({ tipo }: { tipo: TipoIvaConcepto }) {
  const variant: "default" | "secondary" | "outline" =
    tipo === "gravado_16" || tipo === "gravado_8" ? "default" : tipo === "tasa_0" ? "secondary" : "outline";
  return <Badge variant={variant}>{TIPO_IVA_SHORT[tipo]}</Badge>;
}

function RetBadges({ isr, iva }: { isr: number; iva: number }) {
  if (!isr && !iva) return <span className="text-body-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {isr > 0 && <Badge variant="outline" className="text-2xs">ISR {(isr * 100).toFixed(isr === 0.1 ? 0 : 2)}%</Badge>}
      {iva > 0 && <Badge variant="outline" className="text-2xs">IVA {(iva * 100).toFixed(iva === 0.04 ? 0 : 2)}%</Badge>}
    </div>
  );
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
      <div className="col-span-3 truncate">
        <p className="text-body font-medium truncate">{row.descripcion}</p>
        <p className="text-body-sm text-muted-foreground font-mono">SAT {row.clave_sat}</p>
      </div>
      <div className="col-span-1 text-right text-body">{row.cantidad}</div>
      <div className="col-span-2 text-right text-body tabular-nums">{formatCurrency(row.precio_unitario, moneda)}</div>
      <div className="col-span-1 flex justify-center"><IvaBadge tipo={row.tipo_iva} /></div>
      <div className="col-span-2 flex justify-center"><RetBadges isr={row.tasa_ret_isr} iva={row.tasa_ret_iva} /></div>
      <div className="col-span-2 text-right text-body tabular-nums font-medium">{formatCurrency(row.total, moneda)}</div>
      <div className="col-span-1 flex justify-end gap-1">
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
      <div className="col-span-6">
        <Label size="sm" htmlFor="concepto-descripcion">Descripción</Label>
        <Input id="concepto-descripcion" value={draft.descripcion} onChange={(e) => patch({ descripcion: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Label size="sm" htmlFor="concepto-clave-sat">Clave SAT</Label>
        <Input id="concepto-clave-sat" value={draft.clave_sat ?? ""} onChange={(e) => patch({ clave_sat: e.target.value })} />
      </div>
      <div className="col-span-1">
        <Label size="sm">Cant.</Label>
        <NumericInput
          aria-label="Cantidad"
          decimals
          value={draft.cantidad}
          onChange={(n) => patch({ cantidad: n })}
          className="h-10"
        />
        {draft.cantidad <= 0 && (
          <p className="text-body-sm text-destructive">La cantidad debe ser mayor a cero</p>
        )}
      </div>
      <div className="col-span-3">
        <Label size="sm">P. unitario</Label>
        <NumericInput aria-label="Precio unitario" decimals value={draft.precio_unitario || 0} onChange={(n) => patch({ precio_unitario: n })} className="h-10" />
      </div>
      <div className="col-span-2">
        <Label size="sm">IVA</Label>
        <Select value={tipoIva} onValueChange={(v) => patch({ tipo_iva: v as TipoIvaConcepto })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gravado_16">{TIPO_IVA_LABEL.gravado_16}</SelectItem>
            <SelectItem value="gravado_8">{TIPO_IVA_LABEL.gravado_8}</SelectItem>
            <SelectItem value="tasa_0">{TIPO_IVA_LABEL.tasa_0}</SelectItem>
            <SelectItem value="exento">{TIPO_IVA_LABEL.exento}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RetencionSelects
        tasaIsr={draft.tasa_ret_isr ?? 0}
        tasaIva={draft.tasa_ret_iva ?? 0}
        onChange={patch}
      />
      <div className="col-span-12 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar">
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={onSave} disabled={busy || !draft.descripcion.trim() || draft.cantidad <= 0} aria-label="Guardar">
          <Check className="h-4 w-4 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}

export function NuevoRow(props: FormProps) {
  return <FormRow {...props} />;
}
