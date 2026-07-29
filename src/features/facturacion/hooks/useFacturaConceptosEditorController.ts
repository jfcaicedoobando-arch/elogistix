/**
 * useFacturaConceptosEditorController — controla el CRUD de conceptos de
 * un borrador de factura (agregar, actualizar, eliminar), invalidando el
 * caché de conceptos y del detalle de la factura tras cada operación.
 */
import { useState } from "react";
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
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

const EMPTY: ConceptoFacturaInput = {
  descripcion: "",
  cantidad: 1,
  precio_unitario: 0,
  clave_sat: "78101800",
  tipo_iva: "gravado_16",
  tasa_ret_isr: 0,
  tasa_ret_iva: 0,
};

interface Params {
  facturaId: string;
  organizationId: string;
  moneda: Moneda;
}

export function useFacturaConceptosEditorController({ facturaId, organizationId, moneda }: Params) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConceptoFacturaInput>(EMPTY);
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: conceptosFacturaKey(facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId) });
  };

  const handleError = (err: unknown) =>
    notifyError(undefined, { title: "No se pudo guardar el concepto", error: err, method: "FACTURA_CONCEPTOS_EDITOR" });

  const addMut = useMutation({
    mutationFn: (input: ConceptoFacturaInput) =>
      agregarConceptoFactura({ facturaId, organizationId, moneda, input }),
    onSuccess: () => { invalidate(); setShowNew(false); setDraft(EMPTY); },
    onError: handleError,
  });
  const updateMut = useMutation({
    mutationFn: (vars: { conceptoId: string; input: ConceptoFacturaInput }) =>
      actualizarConceptoFactura({ ...vars, facturaId }),
    onSuccess: () => { invalidate(); setEditingId(null); },
    onError: handleError,
  });
  const deleteMut = useMutation({
    mutationFn: (conceptoId: string) => eliminarConceptoFactura({ conceptoId, facturaId }),
    onSuccess: invalidate,
    onError: handleError,
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

  return {
    editingId,
    draft,
    setDraft,
    showNew,
    setShowNew,
    startEdit,
    setEditingId,
    busy,
    addMut,
    updateMut,
    deleteMut,
    EMPTY,
  };
}
