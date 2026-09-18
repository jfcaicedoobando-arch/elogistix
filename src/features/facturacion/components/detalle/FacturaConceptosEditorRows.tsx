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
import { formatCurrency } from "@/lib/formatters";
import { RetencionSelects } from "./FacturaConceptosRetencionSelects";
import { MSG_NO_OBJETO_RETENCIONES } from "@/lib/financial/noObjetoFiscal";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import { FacturaTipoIvaSelect } from "./FacturaTipoIvaSelect";
import { frontera8Bloqueado } from "./facturaTipoIva";
import type {
  ConceptoFacturaInput,
  ConceptoFacturaRow,
  TipoIvaConcepto,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import type { Moneda } from "@/features/facturacion/types";

const TIPO_IVA_SHORT: Record<TipoIvaConcepto, string> = {
  gravado_16: "16%",
  gravado_8: "8%",
  tasa_0: "0%",
  exento: "Exento",
  no_objeto: "No objeto",
};

/**
 * P1 · Auditoría IVA — un renglón legacy sin `tipo_iva` NO se muestra como 16%:
 * se marca "Por confirmar" y exige elección deliberada antes de guardar.
 */
export const LABEL_TRATAMIENTO_PENDIENTE = "Por confirmar";
export const MSG_TRATAMIENTO_PENDIENTE =
  "Este renglón no tiene tratamiento de IVA registrado. Elige el que corresponda (16%, 8%, tasa 0%, exento o no objeto) antes de guardar; el sistema no supone 16%.";

function IvaBadge({ tipo }: { tipo: TipoIvaConcepto | null | undefined }) {
  if (!tipo) return <Badge variant="outline">{LABEL_TRATAMIENTO_PENDIENTE}</Badge>;
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
    return (
      <FormRow draft={draft} setDraft={setDraft} onCancel={onCancelEdit}
        onSave={onSave} busy={busy} tipoOriginal={row.tipo_iva ?? null} />
    );
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
  tipoOriginal?: TipoIvaConcepto | null;
}

export function FormRow({ draft, setDraft, onCancel, onSave, busy, tipoOriginal }: FormProps) {
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const patch = (p: Partial<ConceptoFacturaInput>) => setDraft({ ...draft, ...p });
  // P1 · Auditoría IVA — sin tratamiento guardado el selector queda vacío
  // ("Por confirmar"): editar la descripción o el precio de una fila legacy
  // ya no la declara 16% en silencio.
  const tipoIva: TipoIvaConcepto | undefined = draft.tipo_iva ?? undefined;
  const tratamientoPendiente = !tipoIva;
  // P1 · IVA — ObjetoImp 01 no declara impuestos: al elegir "No objeto" se
  // limpian las retenciones (antes quedaban ocultas y viajaban en el CFDI).
  const noObjeto = tipoIva === "no_objeto";
  const bloqueoFrontera = frontera8Bloqueado(tipoIva, tipoOriginal, fronteraHabilitada);
  const patchTipoIva = (v: TipoIvaConcepto) =>
    patch(v === "no_objeto" ? { tipo_iva: v, tasa_ret_isr: 0, tasa_ret_iva: 0 } : { tipo_iva: v });
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
        <FacturaTipoIvaSelect
          value={tipoIva}
          tipoOriginal={tipoOriginal}
          fronteraHabilitada={fronteraHabilitada}
          placeholder={LABEL_TRATAMIENTO_PENDIENTE}
          onChange={patchTipoIva}
        />
      </div>
      <RetencionSelects
        tasaIsr={noObjeto ? 0 : (draft.tasa_ret_isr ?? 0)}
        tasaIva={noObjeto ? 0 : (draft.tasa_ret_iva ?? 0)}
        onChange={patch}
        disabled={noObjeto}
        hint={MSG_NO_OBJETO_RETENCIONES}
      />
      {tratamientoPendiente && (
        <p className="col-span-12 text-body-sm text-destructive">{MSG_TRATAMIENTO_PENDIENTE}</p>
      )}
      {bloqueoFrontera && (
        <p className="col-span-12 text-body-sm text-destructive">{AVISO_IVA_FRONTERA_DESHABILITADO}</p>
      )}
      <div className="col-span-12 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} aria-label="Cancelar">
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={
            busy || !draft.descripcion.trim() || draft.cantidad <= 0 ||
            tratamientoPendiente || bloqueoFrontera
          }
          aria-label="Guardar"
        >
          <Check className="h-4 w-4 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}

export function NuevoRow(props: FormProps) {
  return <FormRow {...props} />;
}
