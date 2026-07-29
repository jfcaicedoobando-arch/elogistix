/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toggleVinculoReducer, setVinculoMontoReducer, aplicarSugerenciasReducer, type VinculosState } from "./useNuevaFacturaProveedorForm.vinculos";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import type { CfdiParsedResponse, ConceptoCostoAbierto, CfdiConceptoParsed } from "@/features/cxp/services";
import { useCrearFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { CargaMode } from "@/features/cxp/components/CargaCfdiSection";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  type PendingCfdi,
  addDays, initialValues, calcularTotal, validateFactura,
} from "./useNuevaFacturaProveedorForm.helpers";
import { runSubmit } from "./useNuevaFacturaProveedorForm.submit";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/types";
import { aplicarCfdiParsed, aplicarPdfIaParsed } from "./useNuevaFacturaProveedorForm.applyParsed";
import { useConceptosManuales } from "./useConceptosManuales";
import { calcularCuadreConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { useAutoTcEffect } from "./useNuevaFacturaProveedorForm.tcEffect";
import { puedeContinuarSubmit } from "./useNuevaFacturaProveedorForm.guard";
export function useNuevaFacturaProveedorForm(
  onDone: () => void,
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null,
) {
  const { user } = useAuth();
  const { organizationId } = useOrgFilter();
  const crear = useCrearFacturaProveedor();
  const [values, setValues] = useState<FacturaFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [mode, setMode] = useState<CargaMode>("manual");
  const [pendingCfdi, setPendingCfdi] = useState<PendingCfdi | null>(null);
  const [cfdiConceptos, setCfdiConceptos] = useState<CfdiConceptoParsed[]>([]);
  const [askCrearProv, setAskCrearProv] = useState<{ rfc: string; nombre: string } | null>(null);
  const [vinculos, setVinculos] = useState<VinculosState>({});
  const manuales = useConceptosManuales();
  const [embarqueAdHoc, setEmbarqueAdHoc] = useState<EmbarqueSeleccionado | null>(
    initialEmbarqueAdHoc ?? null,
  );
  const [tcOrigen, setTcOrigen] = useState<TcOrigen>("vacio");
  const [tcFechaAplicada, setTcFechaAplicada] = useState<string | undefined>();
  const manualTcRef = useRef(false);
  const tcDof = useTcDofPorFecha((r) => {
    setValues((p) => ({ ...p, tc: String(r.tipoCambio) }));
    setTcOrigen("dof");
    setTcFechaAplicada(r.fechaAplicada);
    if (errors.tc) setErrors((e) => ({ ...e, tc: undefined }));
  });
  const total = useMemo(() => calcularTotal(values), [values]);
  const tcDofRef = useRef(tcDof);
  const tcOrigenRef = useRef(tcOrigen);
  tcDofRef.current = tcDof;
  tcOrigenRef.current = tcOrigen;
  useAutoTcEffect(values.moneda, values.emision, tcOrigenRef, tcDofRef);

  const handleChange = <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => {
    setValues((prev) => {
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
      // Al cambiar moneda reseteamos el origen para permitir auto-fetch nuevo.
      manualTcRef.current = false;
      setTcOrigen(v === "MXN" ? "vacio" : "vacio");
      setTcFechaAplicada(undefined);
    }
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const obtenerDofManual = () => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    manualTcRef.current = false; // botón manual gana sobre "manual" previo
    tcDof.mutate({
      moneda: values.moneda as MonedaTc,
      fecha: values.emision,
      silent: false,
    });
  };


  const handleProveedor = (id: string, nombre: string, diasCreditoProv?: number) => {
    setValues((p) => {
      // v13.315.8 (QW2) — heredamos días de crédito del proveedor y recalculamos
      // vencimiento. Si el proveedor no trae días definidos (undefined) o es 0,
      // conservamos el valor actual del formulario para no perder edits manuales.
      const nextDias = typeof diasCreditoProv === "number" && diasCreditoProv > 0
        ? diasCreditoProv
        : p.diasCredito;
      return {
        ...p,
        provId: id,
        provNombre: nombre,
        diasCredito: nextDias,
        vencimiento: addDays(p.emision, Number(nextDias) || 0),
      };
    });
    if (errors.provId) setErrors((e) => ({ ...e, provId: undefined }));
    setVinculos({});
    setEmbarqueAdHoc(null);
  };

  const toggleVinculo = (c: ConceptoCostoAbierto, checked: boolean) => {
    setVinculos((prev) => toggleVinculoReducer(prev, c, checked));
  };

  const setVinculoMonto = (conceptoId: string, monto: number) => {
    setVinculos((prev) => setVinculoMontoReducer(prev, conceptoId, monto));
  };

  const aplicarSugerencias = (sugs: ReadonlyArray<{
    conceptoId: string; concepto: string; monto: number; embarque_id: string;
  }>) => {
    setVinculos(() => aplicarSugerenciasReducer(sugs));
  };

  const reset = () => {
    setValues(initialValues());
    setErrors({});
    setMode("manual");
    setPendingCfdi(null);
    setCfdiConceptos([]);
    manuales.limpiar();
    setAskCrearProv(null);
    setVinculos({});
    setEmbarqueAdHoc(initialEmbarqueAdHoc ?? null);
    setTcOrigen("vacio");
    setTcFechaAplicada(undefined);
    manualTcRef.current = false;
  };
  const parsedDeps = {
    organizationId,
    setValues, setErrors, setPendingCfdi, setCfdiConceptos,
    setAskCrearProv, setTcOrigen, setTcFechaAplicada, manualTcRef,
  };
  const handleCfdiParsed = (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) =>
    aplicarCfdiParsed(parsedDeps, data, files);
  const handlePdfIaParsed = (data: CfdiParsedResponse, files: { pdf: File }) =>
    aplicarPdfIaParsed(parsedDeps, data, files);
  const validate = (): boolean => {
    const next = validateFactura(values, total);
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  // v13.339.0 (Q-02): si no hay CFDI, se persisten los conceptos capturados a mano.
  const conceptosAPersistir = cfdiConceptos.length > 0 ? cfdiConceptos : manuales.conceptos;

  const cuadreManual = calcularCuadreConceptos(
    Number(values.subtotal) || 0,
    manuales.conceptos.map((c) => ({ monto: Number(c.importe) || 0, cantidad: c.cantidad })),
  );

  const submit = async () => {
    if (!validate()) {
      notifyError(undefined, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_3" });
      return;
    }
    // Bloqueo de captura sin partidas o con partidas descuadradas (Q-02).
    const hayVinculos = Object.keys(vinculos).length > 0;
    if (!puedeContinuarSubmit(cfdiConceptos, hayVinculos, manuales, cuadreManual, Number(values.subtotal) || 0)) {
      return;
    }

    const ok = await runSubmit({
      values, total, userId: user?.id, organizationId,
      pendingCfdi, cfdiConceptos: conceptosAPersistir, vinculos, embarqueAdHoc,
      crearMutateAsync: crear.mutateAsync,
      setFolioError: () => setErrors((e) => ({ ...e, folio: "Ya existe una factura con este folio para este proveedor en esta fecha." })),
    });
    if (ok) { reset(); onDone(); }
  };
  return {
    values, errors, mode, setMode, total, pendingCfdi, cfdiConceptos, askCrearProv, setAskCrearProv,
    handleChange, handleProveedor, handleCfdiParsed, handlePdfIaParsed,
    vinculos, toggleVinculo, setVinculoMonto, aplicarSugerencias,
    conceptosManuales: manuales, cuadreManual,
    embarqueAdHoc, setEmbarqueAdHoc,
    reset, submit, isPending: crear.isPending, organizationId,
    tcOrigen, tcFechaAplicada, obtenerDofManual, dofLoading: tcDof.isPending,
  };
}
