/**
 * Hook controller para DialogNuevaFacturaProveedor.
 * Orquesta estado del formulario, parseo CFDI, validación y submit.
 */
import type { VinculosState } from "./useNuevaFacturaProveedorForm.vinculos";
import { crearAccionesVinculos } from "./useNuevaFacturaProveedorForm.acciones";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import type { CfdiParsedResponse, CfdiConceptoParsed } from "@/features/cxp/services";
import { useCrearFacturaProveedor } from "@/features/cxp/hooks";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { addDays, validateFactura, aplicarProveedorAValues } from "./useNuevaFacturaProveedorForm.helpers";
import { isFechaEmisionValida, type MonedaTc } from "./useTcDofPorFecha";
import { aplicarCfdiParsed, aplicarPdfIaParsed } from "./useNuevaFacturaProveedorForm.applyParsed";
import { useConceptosManuales } from "./useConceptosManuales";
import { calcularCuadreConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { calcularTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";
import { detectarCfdiDuplicado } from "./useNuevaFacturaProveedorForm.dup";
import { editarConceptoIa, eliminarConceptoIa } from "@/features/cxp/utils/conceptosIa";
import { useFacturaFormState } from "./useNuevaFacturaProveedorForm.state";
import { crearSubmit } from "./useNuevaFacturaProveedorForm.buildSubmit";
import { initialValues } from "./useNuevaFacturaProveedorForm.helpers";

export function useNuevaFacturaProveedorForm(
  onDone: (facturaId?: string | null) => void,
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null,
) {
  const { user } = useAuth();
  const { organizationId } = useOrgFilter();
  const crear = useCrearFacturaProveedor();
  const manuales = useConceptosManuales();
  const s = useFacturaFormState(initialEmbarqueAdHoc);
  const {
    values, setValues, errors, setErrors, mode, setMode,
    pendingCfdi, setPendingCfdi, cfdiConceptos, setCfdiConceptos,
    cfdiDuplicado, setCfdiDuplicado, askCrearProv, setAskCrearProv,
    vinculos, setVinculos, embarqueAdHoc, setEmbarqueAdHoc,
    tcOrigen, setTcOrigen, tcFechaAplicada, setTcFechaAplicada,
    manualTcRef, tcDof, total,
  } = s;

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

  // v13.823.21 — Corrección de los conceptos que propuso la IA sobre un PDF
  // (sólo origen `pdf_ia`; el desglose del XML CFDI no se toca).
  const editarConceptoIaLinea = (idx: number, patch: Partial<CfdiConceptoParsed>) =>
    setCfdiConceptos((prev) => editarConceptoIa(prev, idx, patch));
  const eliminarConceptoIaLinea = (idx: number) =>
    setCfdiConceptos((prev) => eliminarConceptoIa(prev, idx));

  const obtenerDofManual = () => {
    if (values.moneda === "MXN") return;
    if (!isFechaEmisionValida(values.emision)) return;
    manualTcRef.current = false; // botón manual gana sobre "manual" previo
    tcDof.mutate({ moneda: values.moneda as MonedaTc, fecha: values.emision, silent: false });
  };

  const handleProveedor = (id: string, nombre: string, diasCreditoProv?: number) => {
    setValues((p) => aplicarProveedorAValues(p, id, nombre, diasCreditoProv));
    if (errors.provId) setErrors((e) => ({ ...e, provId: undefined }));
    setVinculos({});
    setEmbarqueAdHoc(null);
  };

  const { toggleVinculo, setVinculoMonto, aplicarSugerencias, limpiarVinculos } =
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
  const cuadreManual = calcularCuadreConceptos(Number(values.subtotal) || 0,
    manuales.conceptos.map((c) => ({ monto: Number(c.importe) || 0, cantidad: c.cantidad })));
  // Tope: lo vinculado a conceptos de embarque no puede exceder el subtotal.
  const topeVinculacion = calcularTopeVinculacion(Number(values.subtotal) || 0, vinculos as VinculosState);

  const submit = crearSubmit({
    values, total, userId: user?.id, organizationId,
    pendingCfdi, cfdiConceptos, conceptosAPersistir, vinculos, embarqueAdHoc,
    embarqueOrigenId: initialEmbarqueAdHoc?.embarqueId ?? null,
    cfdiDuplicado, topeVinculacion, cuadreManual, manuales,
    validate, crearMutateAsync: crear.mutateAsync,
    setFolioError: () => setErrors((e) => ({ ...e, folio: "Ya existe una factura viva con este folio y fecha para el proveedor. Si es un documento distinto, corrige el folio o la fecha de emisión." })),
    onSuccess: (facturaId) => { reset(); onDone(facturaId); },
  });

  return {
    values, errors, mode, setMode, total, pendingCfdi, cfdiConceptos, askCrearProv, setAskCrearProv,
    editarConceptoIa: editarConceptoIaLinea, eliminarConceptoIa: eliminarConceptoIaLinea,
    handleChange, handleProveedor, handleCfdiParsed, handlePdfIaParsed,
    vinculos, toggleVinculo, setVinculoMonto, aplicarSugerencias, limpiarVinculos,
    conceptosManuales: manuales, cuadreManual, cfdiDuplicado, topeVinculacion,
    // Bloqueo de guardado: CFDI capturado, mutación en curso o tope excedido.
    puedeGuardar: !cfdiDuplicado && !crear.isPending && !topeVinculacion.excede,
    embarqueAdHoc, setEmbarqueAdHoc,
    reset, submit, isPending: crear.isPending, organizationId,
    tcOrigen, tcFechaAplicada, obtenerDofManual, dofLoading: tcDof.isPending,
  };
}
