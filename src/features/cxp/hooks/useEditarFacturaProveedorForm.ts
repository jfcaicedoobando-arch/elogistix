/**
 * Hook controller para DialogEditarFacturaProveedor.
 * Precarga el formulario desde la fila completa (incluye subtotal/iva/retenciones
 * que el shape FacturaCxP no expone) y orquesta el submit vía
 * useActualizarFacturaProveedor. NO toca CFDI ni vínculos a embarque
 * (esos flujos viven en sus propias secciones).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useActualizarFacturaProveedor } from "@/features/cxp/hooks";
import {
  fetchFacturaParaEdicion,
  type ActualizarFacturaPayload,
  type FacturaCxP,
  type FacturaParaEdicion,
} from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import {
  addDays,
  calcularTotal,
  validateFactura,
} from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";
import { notifyError } from "@/components/shared/utils/appFeedback";

type RowLite = FacturaParaEdicion;

function fromRow(r: RowLite): FacturaFormValues {
  const sub = Number(r.subtotal) || 0;
  const iva = Number(r.iva) || 0;
  const ieps = Number(r.ieps ?? 0) || 0;
  const ret = Number(r.retenciones) || 0;
  const tc = Number(r.tipo_cambio_usd) || 0;
  return {
    provId: r.proveedor_id,
    provNombre: r.proveedor_nombre,
    folio: r.folio_proveedor,
    emision: r.fecha_emision,
    diasCredito: Number(r.dias_credito) || 0,
    vencimiento: r.fecha_vencimiento ?? addDays(r.fecha_emision, Number(r.dias_credito) || 0),
    moneda: r.moneda,
    tc: r.moneda === "MXN" ? "" : (tc ? String(tc) : ""),
    subtotal: sub ? String(sub) : "",
    iva: iva ? String(iva) : "",
    ieps: ieps ? String(ieps) : "",
    retenciones: ret ? String(ret) : "",
    categoriaId: r.categoria_presupuesto_id ?? "",
    notas: r.notas ?? "",
  };
}

interface UseEditarParams {
  factura: FacturaCxP | null;
  onDone: () => void;
}

export function useEditarFacturaProveedorForm({ factura, onDone }: UseEditarParams) {
  const actualizar = useActualizarFacturaProveedor();
  const { data: row, isLoading: isLoadingRow, isError: isErrorRow } = useQuery({
    queryKey: ["cxp", "factura-edit-row", factura?.id ?? null] as const,
    queryFn: () => fetchFacturaParaEdicion(factura!.id),
    enabled: !!factura?.id,
    staleTime: 10_000,
  });

  const [values, setValues] = useState<FacturaFormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [initial, setInitial] = useState<FacturaFormValues | null>(null);

  useEffect(() => {
    if (row) {
      const v = fromRow(row);
      setValues(v);
      setInitial(v);
      setErrors({});
    } else if (!factura) {
      setValues(null);
      setInitial(null);
      setErrors({});
    }
  }, [row, factura]);

  const total = useMemo(() => (values ? calcularTotal(values) : 0), [values]);

  const handleChange = <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => {
    setValues((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [k]: v };
      if (k === "emision" || k === "diasCredito") {
        next.vencimiento = addDays(next.emision, Number(next.diasCredito) || 0);
      }
      return next;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Proveedor NO editable: callback no-op para satisfacer el contrato del form reutilizado.
  const handleProveedorNoop = () => { /* read-only en edit */ };

  const hayCambios = useMemo(() => {
    if (!initial || !values) return false;
    return (Object.keys(initial) as Array<keyof FacturaFormValues>).some(
      (k) => initial[k] !== values[k],
    );
  }, [initial, values]);

  const submit = async () => {
    if (!factura || !values) return;
    const next = validateFactura(values, total);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      notifyError(toast, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USEEDITARFACTURAPROVEEDORFORM_1" });
      return;
    }
    const payload: ActualizarFacturaPayload = {
      folio_proveedor: values.folio.trim(),
      fecha_emision: values.emision,
      fecha_vencimiento: values.vencimiento,
      dias_credito: Number(values.diasCredito) || 0,
      moneda: values.moneda,
      tipo_cambio_usd: Number(values.tc) || 0,
      subtotal: Number(values.subtotal) || 0,
      iva: Number(values.iva) || 0,
      ieps: Number(values.ieps) || 0,
      retenciones: Number(values.retenciones) || 0,
      categoria_presupuesto_id: values.categoriaId,
      notas: values.notas,
    };
    try {
      await actualizar.mutateAsync({ id: factura.id, payload });
      onDone();
    } catch {
      // Notificación gestionada por el hook.
    }
  };

  return {
    values, errors, total,
    handleChange, handleProveedor: handleProveedorNoop,
    hayCambios, submit,
    isPending: actualizar.isPending,
    isLoadingRow,
    isErrorRow,
  };
}
