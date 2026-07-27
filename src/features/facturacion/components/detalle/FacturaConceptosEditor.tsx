/**
 * FacturaConceptosEditor — editor CRUD de renglones de un borrador.
 * Sólo visible cuando la factura está en estado `Borrador` y el usuario
 * tiene permiso de edición. Escribe en `conceptos_factura` y dispara el
 * recálculo de subtotal/IVA/total en la factura padre.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  agregarConceptoFactura,
  actualizarConceptoFactura,
  eliminarConceptoFactura,
  type ConceptoFacturaInput,
  type ConceptoFacturaRow,
} from "@/features/facturacion/services/conceptosFacturaCrud";
import { conceptosFacturaKey } from "@/features/facturacion/hooks/useConceptosFactura";
import { ConceptoRow, NuevoRow } from "./FacturaConceptosEditorRows";
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
  tipo_iva: "gravado_16",
  tasa_ret_isr: 0,
  tasa_ret_iva: 0,
};

export function FacturaConceptosEditor({ facturaId, organizationId, moneda, conceptos }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConceptoFacturaInput>(EMPTY);
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: conceptosFacturaKey(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId) });
  };

  const onError = (err: unknown) =>
    notifyError(undefined, { title: "No se pudo guardar el concepto", error: err, method: "FACTURA_CONCEPTOS_EDITOR" });

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
      tipo_iva: row.tipo_iva,
      tasa_ret_isr: row.tasa_ret_isr ?? 0,
      tasa_ret_iva: row.tasa_ret_iva ?? 0,
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
