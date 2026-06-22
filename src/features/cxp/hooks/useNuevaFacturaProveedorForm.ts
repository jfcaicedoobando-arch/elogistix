/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 * Helpers puros viven en `useNuevaFacturaProveedorForm.helpers.ts`.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import { findProveedorByRfcEnOrg } from "@/features/proveedor/services";
import {
  type CfdiParsedResponse,
  type ConceptoCostoAbierto,
} from "@/features/cxp/services";
import { useCrearFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import type { CargaMode } from "@/features/cxp/components/CargaCfdiSection";
import type { SeleccionLinea } from "@/features/cxp/components/VincularEmbarqueSection";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { uploadCfdiSafe, vincularSafe } from "./useNuevaFacturaProveedorForm.sideEffects";
import {
  type PendingCfdi,
  type VinculoLinea,
  addDays,
  initialValues,
  calcularTotal,
  validateFactura,
  buildPayload,
  mapCfdiToValues,
} from "./useNuevaFacturaProveedorForm.helpers";

type VinculosState = Record<string, SeleccionLinea & VinculoLinea>;

export function useNuevaFacturaProveedorForm(onDone: () => void) {
  const { user } = useAuth();
  const { organizationId } = useOrgFilter();
  const crear = useCrearFacturaProveedor();
  const [values, setValues] = useState<FacturaFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const [mode, setMode] = useState<CargaMode>("manual");
  const [pendingCfdi, setPendingCfdi] = useState<PendingCfdi | null>(null);
  const [askCrearProv, setAskCrearProv] = useState<{ rfc: string; nombre: string } | null>(null);
  const [vinculos, setVinculos] = useState<VinculosState>({});
  const [embarqueAdHoc, setEmbarqueAdHoc] = useState<EmbarqueSeleccionado | null>(null);

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

  const reset = () => {
    setValues(initialValues());
    setErrors({});
    setMode("manual");
    setPendingCfdi(null);
    setAskCrearProv(null);
    setVinculos({});
    setEmbarqueAdHoc(null);
  };

  const handleCfdiParsed = async (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => {
    const c = data.cfdi;
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
      toast.success("Factura de proveedor capturada");
      reset();
      onDone();
    } catch (e) {
      handleSubmitError(e);
    }
  };

  return {
    values, errors, mode, setMode,
    total, pendingCfdi, askCrearProv, setAskCrearProv,
    handleChange, handleProveedor, handleCfdiParsed,
    vinculos, toggleVinculo, setVinculoMonto,
    embarqueAdHoc, setEmbarqueAdHoc,
    reset, submit,
    isPending: crear.isPending,
    organizationId,
  };
}
