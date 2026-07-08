/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services";
import {
  type CfdiParsedResponse, type ConceptoCostoAbierto,
  existeFacturaDuplicada, validarCuadreCfdi,
} from "@/features/cxp/services";
import { useCrearFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { CargaMode } from "@/features/cxp/components/CargaCfdiSection";
import type { SeleccionLinea } from "@/features/cxp/components/VincularEmbarqueSection";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { uploadCfdiSafe, vincularSafe, buildFacturaSuccessDescription } from "./useNuevaFacturaProveedorForm.sideEffects";
import {
  type PendingCfdi, type VinculoLinea,
  addDays, initialValues, calcularTotal, validateFactura, buildPayload, mapCfdiToValues,
} from "./useNuevaFacturaProveedorForm.helpers";
import { useTcDofPorFecha, isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import type { TcOrigen } from "@/features/cxp/components/FacturaProveedorFormFields";

type VinculosState = Record<string, SeleccionLinea & VinculoLinea>;

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

  // Auto-fetch del TC DOF cuando hay moneda ≠ MXN + fecha emisión válida.
  // Se dispara al cambiar moneda o emisión; NO pisa un TC manual ni uno del CFDI.
  useEffect(() => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    if (tcOrigen === "manual" || tcOrigen === "cfdi") return;
    const t = setTimeout(() => {
      tcDof.mutate({
        moneda: values.moneda as MonedaTc,
        fecha: values.emision,
        silent: true,
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setVinculos((prev) => {
      const next = { ...prev };
      if (!checked) { delete next[c.id]; return next; }
      next[c.id] = {
        embarqueId: c.embarque_id,
        descripcion: c.concepto,
        monto: c.monto,
        montoOriginal: c.monto,
      };
      return next;
    });
  };

  const setVinculoMonto = (conceptoId: string, monto: number) => {
    setVinculos((prev) => prev[conceptoId]
      ? { ...prev, [conceptoId]: { ...prev[conceptoId], monto } }
      : prev);
  };
  // Reemplaza vínculos por las sugerencias del matcher.
  const aplicarSugerencias = (sugs: ReadonlyArray<{
    conceptoId: string; concepto: string; monto: number; embarque_id: string;
  }>) => {
    setVinculos(() => {
      const next: VinculosState = {};
      for (const s of sugs) {
        next[s.conceptoId] = {
          embarqueId: s.embarque_id, descripcion: s.concepto,
          monto: s.monto, montoOriginal: s.monto,
        };
      }
      return next;
    });
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
    const c = data.cfdi;

    // Validación fiscal: el desglose de IVA/IEPS por concepto debe cuadrar
    // contra los totales declarados en el CFDI antes de registrar el gasto.
    const cuadre = validarCuadreCfdi(c);
    if (!cuadre.ok) {
      notifyError(toast, {
        title: "El CFDI no cuadra y no se puede registrar",
        description: cuadre.errores.join(" "),
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CUADRE",
      });
      return;
    }

    let provId = "";
    let provNombre = c.emisor.nombre;
    try {
      const found = await findProveedorByRfcEnOrg(c.emisor.rfc, organizationId);
      if (found) { provId = found.id; provNombre = found.nombre; }
      else setAskCrearProv({ rfc: c.emisor.rfc, nombre: c.emisor.nombre });
    } catch { /* lookup opcional */ }

    setValues(mapCfdiToValues(data, provId, provNombre));
    setErrors({});
    setPendingCfdi({ uuid: c.uuid, rfcEmisor: c.emisor.rfc, xmlFile: files.xml, pdfFile: files.pdf });
    // El XML del CFDI trae el tipo_cambio oficial del emisor — respetarlo.
    if (c.moneda !== "MXN" && Number(c.tipo_cambio) > 0) {
      setTcOrigen("cfdi");
      setTcFechaAplicada(c.fecha);
      manualTcRef.current = false;
    } else {
      setTcOrigen("vacio");
      setTcFechaAplicada(undefined);
    }
  };


  const validate = (): boolean => {
    const next = validateFactura(values, total);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmitError = (e: unknown) => {
    const err = e as { message?: string; code?: string };
    if (err.code === "23505" || /uuid_fiscal/i.test(err.message ?? "")) {
      notifyError(toast, { title: "Ya existe una factura con este UUID fiscal (CFDI duplicado).", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_1" });
    } else {
      notifyError(toast, { title: err.message ?? "Error al capturar", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_2" });
    }
  };

  const submit = async () => {
    if (!validate()) {
      notifyError(toast, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_3" });
      return;
    }
    // Bloqueo de duplicados: mismo proveedor + folio + fecha emisión.
    try {
      const dup = await existeFacturaDuplicada(values.provId, values.folio, values.emision);
      if (dup) {
        setErrors((e) => ({ ...e, folio: "Ya existe una factura con este folio para este proveedor en esta fecha." }));
        notifyError(toast, {
          title: "Factura duplicada",
          description: `Ya capturaste el folio ${values.folio.trim()} de este proveedor el ${values.emision}.`,
          method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DUP",
        });
        return;
      }
    } catch {
      // Si la verificación falla (red, RLS), continuamos: el UNIQUE de UUID fiscal sigue protegiendo.
    }
    try {
      const created = await crear.mutateAsync(
        buildPayload({ values, total, userId: user?.id, pendingCfdi, vinculos }),
      );
      if (created?.id) {
        await uploadCfdiSafe({ facturaId: created.id, organizationId, pendingCfdi });
        await vincularSafe({
          facturaId: created.id, organizationId, values, total, vinculos, embarqueAdHoc,
        });
      }
      toast.success("Factura de proveedor capturada");
      reset();
      onDone();
    } catch (e) {
      handleSubmitError(e);
    }
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
