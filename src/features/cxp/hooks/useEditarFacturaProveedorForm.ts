/**
 * Hook controller para DialogEditarFacturaProveedor.
 * Precarga el formulario desde una factura existente y orquesta el submit
 * vía useActualizarFacturaProveedor. NO toca CFDI ni vínculos a embarque
 * (esos flujos viven en sus propias secciones).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useActualizarFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import type { ActualizarFacturaPayload } from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import {
  addDays,
  calcularTotal,
  validateFactura,
} from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";
import { notifyError } from "@/components/shared/utils/appFeedback";

function fromFactura(f: FacturaCxP & { subtotal?: number; iva?: number; retenciones?: number; notas?: string; dias_credito?: number }): FacturaFormValues {
  const x = f as unknown as Record<string, unknown>;
  const num = (k: string) => Number(x[k]) || 0;
  const str = (k: string) => (x[k] == null ? "" : String(x[k]));
  return {
    provId: f.proveedor_id,
    provNombre: f.proveedor_nombre,
    folio: f.folio_proveedor,
    emision: f.fecha_emision,
    diasCredito: num("dias_credito"),
    vencimiento: f.fecha_vencimiento ?? addDays(f.fecha_emision, num("dias_credito")),
    moneda: f.moneda,
    tc: f.moneda === "MXN" ? "" : String(f.tipo_cambio_usd || ""),
    subtotal: num("subtotal") ? String(num("subtotal")) : "",
    iva: num("iva") ? String(num("iva")) : "",
    retenciones: num("retenciones") ? String(num("retenciones")) : "",
    categoriaId: f.categoria_presupuesto_id ?? "",
    notas: str("notas"),
  };
}

interface UseEditarParams {
  factura: FacturaCxP | null;
  onDone: () => void;
}

export function useEditarFacturaProveedorForm({ factura, onDone }: UseEditarParams) {
  const actualizar = useActualizarFacturaProveedor();
  const [values, setValues] = useState<FacturaFormValues>(() =>
    factura ? fromFactura(factura) : ({} as FacturaFormValues),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [initial, setInitial] = useState<FacturaFormValues | null>(
    factura ? fromFactura(factura) : null,
  );

  // Recarga al cambiar de factura objetivo.
  useEffect(() => {
    if (factura) {
      const v = fromFactura(factura);
      setValues(v);
      setInitial(v);
      setErrors({});
    }
  }, [factura?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => calcularTotal(values), [values]);

  const handleChange = <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "emision" || k === "diasCredito") {
        next.vencimiento = addDays(next.emision, Number(next.diasCredito) || 0);
      }
      return next;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Proveedor NO editable en edición; el callback queda como no-op para
  // satisfacer el contrato del componente reutilizado.
  const handleProveedorNoop = () => { /* read-only en edit */ };

  const hayCambios = useMemo(() => {
    if (!initial) return false;
    return (Object.keys(initial) as Array<keyof FacturaFormValues>).some(
      (k) => initial[k] !== values[k],
    );
  }, [initial, values]);

  const submit = async () => {
    if (!factura) return;
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
      retenciones: Number(values.retenciones) || 0,
      categoria_presupuesto_id: values.categoriaId || null,
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
  };
}
