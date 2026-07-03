/**
 * FacturaConceptosEditor — editor CRUD de renglones de un borrador.
 * Sólo visible cuando la factura está en estado `Borrador` y el usuario
 * tiene permiso de edición. Escribe en `conceptos_factura` y dispara el
 * recálculo de subtotal/IVA/total en la factura padre.
 */
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors/index";
import { queryKeys } from "@/lib/query";
import { formatCurrency } from "@/lib/formatters";
import {
  agregarConceptoFactura,
  actualizarConceptoFactura,
  eliminarConceptoFactura,
  type ConceptoFacturaInput,
  type ConceptoFacturaRow,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import { conceptosFacturaKey } from "@/features/facturacion/hooks/useConceptosFactura";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

interface Props {
  facturaId: string;
  organizationId: string;
  moneda: Moneda;
  conceptos: ConceptoFacturaRow[];
}

const EMPTY: ConceptoFacturaInput = {
  descripcion: "",
  cantidad: 1,
  precio_unitario: 0,
  clave_sat: "78101800",
};

export function FacturaConceptosEditor({ facturaId, organizationId, moneda, conceptos }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConceptoFacturaInput>(EMPTY);
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: conceptosFacturaKey(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId) });
  };

  const onError = (err: unknown) =>
    toast({ title: "No se pudo guardar el concepto", description: getErrorMessage(err), variant: "destructive" });

  const addMut = useMutation({
    mutationFn: (input: ConceptoFacturaInput) =>
      agregarConceptoFactura({ facturaId, organizationId, moneda, input }),
    onSuccess: () => { invalidate(); setShowNew(false); setDraft(EMPTY); },
    onError,
  });
  const updateMut = useMutation({
    mutationFn: (vars: { conceptoId: string; input: ConceptoFacturaInput }) =>
      actualizarConceptoFactura({ ...vars, facturaId }),
    onSuccess: () => { invalidate(); setEditingId(null); },
    onError,
  });
  const deleteMut = useMutation({
    mutationFn: (conceptoId: string) => eliminarConceptoFactura({ conceptoId, facturaId }),
    onSuccess: invalidate,
    onError,
  });

  const startEdit = (row: ConceptoFacturaRow) => {
    setEditingId(row.id);
    setDraft({
      descripcion: row.descripcion,
      cantidad: row.cantidad,
      precio_unitario: row.precio_unitario,
      clave_sat: row.clave_sat,
    });
  };

  const busy = addMut.isPending || updateMut.isPending || deleteMut.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Editar conceptos del borrador</CardTitle>
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => { setShowNew(true); setDraft(EMPTY); }}
          disabled={showNew || busy}
        >
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {conceptos.length === 0 && !showNew && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Este borrador aún no tiene conceptos. Agrega al menos uno antes de timbrar.
          </p>
        )}

        {conceptos.map((row) => (
          <ConceptoRow
            key={row.id} row={row} moneda={moneda}
            isEditing={editingId === row.id}
            draft={draft} setDraft={setDraft}
            onStartEdit={() => startEdit(row)}
            onCancelEdit={() => setEditingId(null)}
            onSave={() => updateMut.mutate({ conceptoId: row.id, input: draft })}
            onDelete={() => deleteMut.mutate(row.id)}
            busy={busy}
          />
        ))}

        {showNew && (
          <NuevoRow
            draft={draft} setDraft={setDraft}
            onCancel={() => { setShowNew(false); setDraft(EMPTY); }}
            onSave={() => addMut.mutate(draft)}
            busy={busy}
          />
        )}
      </CardContent>
    </Card>
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

function ConceptoRow({ row, moneda, isEditing, draft, setDraft, onStartEdit, onCancelEdit, onSave, onDelete, busy }: RowProps) {
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

function FormRow({ draft, setDraft, onCancel, onSave, busy }: FormProps) {
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

function NuevoRow(props: FormProps) {
  return <FormRow {...props} />;
}
