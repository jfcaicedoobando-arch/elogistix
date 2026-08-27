/**
 * Hook controller para DialogEditarFacturaProveedor.
 * Precarga el formulario desde la fila completa (incluye subtotal/iva/retenciones
 * que el shape FacturaCxP no expone) y orquesta el submit vía
 * useActualizarFacturaProveedor. NO toca CFDI ni vínculos a embarque
 * (esos flujos viven en sus propias secciones).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useActualizarFacturaProveedor } from "@/features/cxp/hooks";
import {
  fetchFacturaParaEdicion,
  type ActualizarFacturaPayload,
  type FacturaCxP,
  type FacturaParaEdicion,
} from "@/features/cxp/services";
import type { FacturaFormValues } from "@/features/cxp/types";
import {
  addDays,
  calcularTotal,
  validateFactura,
} from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";
import { notifyError } from "@/lib/ui/appFeedback";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/types";


type RowLite = FacturaParaEdicion;

function numOrEmpty(v: unknown): string {
  const n = Number(v ?? 0) || 0;
  return n ? String(n) : "";
}

function fromRow(r: RowLite): FacturaFormValues {
  const dias = Number(r.dias_credito) || 0;
  const tc = Number(r.tipo_cambio_usd) || 0;
  return {
    provId: r.proveedor_id,
    provNombre: r.proveedor_nombre,
    folio: r.folio_proveedor,
    emision: r.fecha_emision,
    diasCredito: dias,
    vencimiento: r.fecha_vencimiento ?? addDays(r.fecha_emision, dias),
    moneda: r.moneda,
    tc: r.moneda === "MXN" ? "" : (tc ? String(tc) : ""),
    subtotal: numOrEmpty(r.subtotal),
    iva: numOrEmpty(r.iva),
    ieps: numOrEmpty(r.ieps),
    retenciones: numOrEmpty(r.retenciones),
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
    queryKey: queryKeys.cxp.facturaEditRow(factura?.id ?? null),
    queryFn: () => fetchFacturaParaEdicion(factura!.id),
    enabled: !!factura?.id,
    staleTime: 10_000,
  });

  const [values, setValues] = useState<FacturaFormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [initial, setInitial] = useState<FacturaFormValues | null>(null);
  const [tcOrigen, setTcOrigen] = useState<TcOrigen>("vacio");
  const [tcFechaAplicada, setTcFechaAplicada] = useState<string | undefined>();
  const manualTcRef = useRef(false);
  // M10 (S2-10): re-sincronizar row→state SOLO al abrir/cambiar de factura.
  // Un refetch del mismo id (invalidación por pago, foco de ventana, staleTime
  // agotado) no debe pisar la captura en curso del modal.
  const lastLoadedId = useRef<string | null>(null);

  const tcDof = useTcDofPorFecha((r) => {
    setValues((p) => (p ? { ...p, tc: String(r.tipoCambio) } : p));
    setTcOrigen("dof");
    setTcFechaAplicada(r.fechaAplicada);
    if (errors.tc) setErrors((e) => ({ ...e, tc: undefined }));
  });

  useEffect(() => {
    if (row) {
      if (lastLoadedId.current === factura?.id) return;
      lastLoadedId.current = factura?.id ?? null;
      const v = fromRow(row);
      setValues(v);
      setInitial(v);
      setErrors({});
      // Al cargar factura existente, si tiene TC lo consideramos "manual" (valor
      // ya guardado por el usuario o legacy) hasta que decida re-consultar DOF.
      setTcOrigen(v.moneda !== "MXN" && v.tc ? "manual" : "vacio");
      setTcFechaAplicada(undefined);
      manualTcRef.current = v.moneda !== "MXN" && !!v.tc;
    } else if (!factura) {
      lastLoadedId.current = null;
      setValues(null);
      setInitial(null);
      setErrors({});
      setTcOrigen("vacio");
      setTcFechaAplicada(undefined);
      manualTcRef.current = false;
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
    if (k === "tc") {
      manualTcRef.current = true;
      setTcOrigen(v ? "manual" : "vacio");
      setTcFechaAplicada(undefined);
    }
    if (k === "moneda") {
      manualTcRef.current = false;
      setTcOrigen("vacio");
      setTcFechaAplicada(undefined);
    }
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const obtenerDofManual = () => {
    if (!values || values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    manualTcRef.current = false;
    tcDof.mutate({
      moneda: values.moneda as MonedaTc,
      fecha: values.emision,
      silent: false,
    });
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
      notifyError(undefined, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USEEDITARFACTURAPROVEEDORFORM_1" });
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
      await actualizar.mutateAsync({ id: factura.id, payload, expectedUpdatedAt: row?.updated_at ?? null });
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
    tcOrigen, tcFechaAplicada, obtenerDofManual, dofLoading: tcDof.isPending,
  };

}
