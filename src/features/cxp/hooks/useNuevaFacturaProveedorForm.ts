/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toggleVinculoReducer, setVinculoMontoReducer, aplicarSugerenciasReducer, type VinculosState } from "./useNuevaFacturaProveedorForm.vinculos";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import type { CfdiParsedResponse, ConceptoCostoAbierto } from "@/features/cxp/services";
import { useCrearFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { CargaMode } from "@/features/cxp/components/CargaCfdiSection";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  type PendingCfdi,
  addDays, initialValues, calcularTotal, validateFactura,
} from "./useNuevaFacturaProveedorForm.helpers";
import { procesarCfdiParsed } from "./useNuevaFacturaProveedorForm.cfdi";
import { runSubmit } from "./useNuevaFacturaProveedorForm.submit";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/components/FacturaProveedorFormFields";
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
  const [askCrearProv, setAskCrearProv] = useState<{ rfc: string; nombre: string } | null>(null);
  const [vinculos, setVinculos] = useState<VinculosState>({});
  const [embarqueAdHoc, setEmbarqueAdHoc] = useState<EmbarqueSeleccionado | null>(
    initialEmbarqueAdHoc ?? null,
  );
  const [tcOrigen, setTcOrigen] = useState<TcOrigen>("vacio");
  const [tcFechaAplicada, setTcFechaAplicada] = useState<string | undefined>();
  // Marca puesta por el usuario cuando escribe manualmente el TC; evita que el
  // auto-fetch la sobreescriba en el próximo cambio de fecha.
  const manualTcRef = useRef(false);

  // Mutación que consulta el TC DOF vigente para la fecha de emisión.
  const tcDof = useTcDofPorFecha((r) => {
    setValues((p) => ({ ...p, tc: String(r.tipoCambio) }));
    setTcOrigen("dof");
    setTcFechaAplicada(r.fechaAplicada);
    if (errors.tc) setErrors((e) => ({ ...e, tc: undefined }));
  });

  const total = useMemo(() => calcularTotal(values), [values]);

  // Refs a `tcDof` (mutation) y `tcOrigen` para que el auto-fetch sólo
  // se re-suscriba al cambiar moneda/emisión, no cuando el origen o el
  // objeto de mutación cambian de identidad.
  const tcDofRef = useRef(tcDof);
  const tcOrigenRef = useRef(tcOrigen);
  tcDofRef.current = tcDof;
  tcOrigenRef.current = tcOrigen;

  // Auto-fetch del TC DOF cuando hay moneda ≠ MXN + fecha emisión válida.
  // Se dispara al cambiar moneda o emisión; NO pisa un TC manual ni uno del CFDI.
  useEffect(() => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    const origen = tcOrigenRef.current;
    if (origen === "manual" || origen === "cfdi") return;
    const t = setTimeout(() => {
      tcDofRef.current.mutate({
        moneda: values.moneda as MonedaTc,
        fecha: values.emision,
        silent: true,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [values.moneda, values.emision]);

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


  const handleProveedor = (id: string, nombre: string) => {
    setValues((p) => ({ ...p, provId: id, provNombre: nombre }));
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
    setAskCrearProv(null);
    setVinculos({});
    setEmbarqueAdHoc(initialEmbarqueAdHoc ?? null);
    setTcOrigen("vacio");
    setTcFechaAplicada(undefined);
    manualTcRef.current = false;
  };


  const handleCfdiParsed = async (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    const result = await procesarCfdiParsed(data, files, organizationId);
    if (!result.ok) {
      notifyError(toast, {
        title: "El CFDI no cuadra y no se puede registrar",
        description: result.cuadreError,
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CUADRE",
      });
      return;
    }
    setValues(result.values);
    setErrors({});
    setPendingCfdi(result.pendingCfdi);
    setAskCrearProv(result.askCrearProv);
    setTcOrigen(result.tcOrigen);
    setTcFechaAplicada(result.tcFechaAplicada);
    manualTcRef.current = false;
  };


  const validate = (): boolean => {
    const next = validateFactura(values, total);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      notifyError(toast, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_3" });
      return;
    }
    const ok = await runSubmit({
      values, total, userId: user?.id, organizationId,
      pendingCfdi, vinculos, embarqueAdHoc,
      crearMutateAsync: crear.mutateAsync,
      setFolioError: () => setErrors((e) => ({ ...e, folio: "Ya existe una factura con este folio para este proveedor en esta fecha." })),
    });
    if (ok) { reset(); onDone(); }
  };

  return {
    values, errors, mode, setMode, total, pendingCfdi, askCrearProv, setAskCrearProv,
    handleChange, handleProveedor, handleCfdiParsed,
    vinculos, toggleVinculo, setVinculoMonto, aplicarSugerencias,
    embarqueAdHoc, setEmbarqueAdHoc,
    reset, submit, isPending: crear.isPending, organizationId,
    tcOrigen, tcFechaAplicada, obtenerDofManual, dofLoading: tcDof.isPending,
  };

}
