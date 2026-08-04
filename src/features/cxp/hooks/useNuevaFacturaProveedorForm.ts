/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 */
import { useMemo, useRef, useState } from "react";
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
  addDays, initialValues, calcularTotal, validateFactura, aplicarProveedorAValues,
} from "./useNuevaFacturaProveedorForm.helpers";
import { runSubmit } from "./useNuevaFacturaProveedorForm.submit";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/types";
import { aplicarCfdiParsed, aplicarPdfIaParsed } from "./useNuevaFacturaProveedorForm.applyParsed";
import { useConceptosManuales } from "./useConceptosManuales";
import { calcularCuadreConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { useAutoTcEffect } from "./useNuevaFacturaProveedorForm.tcEffect";
import { puedeContinuarSubmit, puedeContinuarTope } from "./useNuevaFacturaProveedorForm.guard";
import { calcularTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";

import { detectarCfdiDuplicado, type FacturaExistentePorUuid } from "./useNuevaFacturaProveedorForm.dup";
export function useNuevaFacturaProveedorForm(
  onDone: (facturaId?: string | null) => void,
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
  // v13.343.0 — aviso temprano de CFDI ya capturado (índice único por UUID fiscal).
  const [cfdiDuplicado, setCfdiDuplicado] = useState<FacturaExistentePorUuid | null>(null);
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
    setValues((p) => aplicarProveedorAValues(p, id, nombre, diasCreditoProv));
    if (errors.provId) setErrors((e) => ({ ...e, provId: undefined }));
    setVinculos({});
    setEmbarqueAdHoc(null);
  };

  const { toggleVinculo, setVinculoMonto, aplicarSugerencias } =
    crearAccionesVinculos(setVinculos);


  const reset = () => {
    setValues(initialValues());
    setErrors({});
    setMode("manual");
    setPendingCfdi(null);
    setCfdiConceptos([]);
    setCfdiDuplicado(null);
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
  const handleCfdiParsed = async (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    setCfdiDuplicado(null);
    const ok = await aplicarCfdiParsed(parsedDeps, data, files);
    if (ok) setCfdiDuplicado(await detectarCfdiDuplicado(data.cfdi?.uuid));
    return ok;
  };
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

  // Tope de vinculación: lo asignado a conceptos de embarque no puede exceder
  // el subtotal de la factura (los conceptos de costo van sin impuestos).
  const topeVinculacion = calcularTopeVinculacion(Number(values.subtotal) || 0, vinculos);


  const submit = async () => {
    if (cfdiDuplicado) {
      notifyError(undefined, {
        title: "Este CFDI ya está capturado",
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_UUID_UI",
      });
      return;
    }
    if (!validate()) {
      notifyError(undefined, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_3" });
      return;
    }
    // Bloqueo de captura sin partidas o con partidas descuadradas (Q-02).
    const hayVinculos = Object.keys(vinculos).length > 0;
    if (!puedeContinuarTope(topeVinculacion, Number(values.subtotal) || 0, values.moneda)) {
      return;
    }
    if (!puedeContinuarSubmit(cfdiConceptos, hayVinculos, manuales, cuadreManual, Number(values.subtotal) || 0)) {
      return;
    }


    const res = await runSubmit({
      values, total, userId: user?.id, organizationId,
      pendingCfdi, cfdiConceptos: conceptosAPersistir, vinculos, embarqueAdHoc,
      crearMutateAsync: crear.mutateAsync,
      setFolioError: () => setErrors((e) => ({ ...e, folio: "Ya existe una factura con este folio para este proveedor en esta fecha." })),
    });
    if (res.ok) { reset(); onDone(res.facturaId); }
  };
  return {
    values, errors, mode, setMode, total, pendingCfdi, cfdiConceptos, askCrearProv, setAskCrearProv,
    handleChange, handleProveedor, handleCfdiParsed, handlePdfIaParsed,
    vinculos, toggleVinculo, setVinculoMonto, aplicarSugerencias,
    conceptosManuales: manuales, cuadreManual, cfdiDuplicado, topeVinculacion,
    // Bloqueo de guardado: CFDI ya capturado, mutación en curso o vinculación
    // que excede el subtotal de la factura.
    puedeGuardar: !cfdiDuplicado && !crear.isPending && !topeVinculacion.excede,

    embarqueAdHoc, setEmbarqueAdHoc,
    reset, submit, isPending: crear.isPending, organizationId,
    tcOrigen, tcFechaAplicada, obtenerDofManual, dofLoading: tcDof.isPending,
  };
}
