import { accionRecuperarCapturaPricing } from "./recuperarCapturaPricing";
import { useVinculoCrmPaso1 } from "./useVinculoCrmPaso1";
/**
 * Handlers del Paso 1 del wizard de cotización (extraídos de
 * `useCotizacionWizardSteps` para mantenerlo bajo el límite Power-of-10
 * de 200 líneas). Ambos handlers comparten validación CRM, llamada a
 * `savePaso1` y vinculación CRM tras crear.
 */
import { useCallback, useEffect, useRef } from "react";
import { guardarPaso1Pricing } from "./guardarPaso1Pricing";
import { limpiarIdentidadPricingObsoleta } from "./identidadPricing";
import { queryClient } from "@/lib/query/queryClient";
import { errorCoherenciaEstricta } from "@/features/cotizacion/hooks/wizard/resolverPuertosTarifa";
import type { Path, UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { CreateCotizacionInput, CotizacionRow } from "@/features/cotizacion/hooks/useCotizaciones";
import { savePaso1 } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/lib/ui/appFeedback";
import { validatePaso1, campoParaPathSchemaPaso1 } from "./handlePaso1Crm";
import { scrollAndFocusSection, seccionParaErrorPaso1, campoParaErrorPaso1 } from "./scrollToErrorSection";

/**
 * VF-09: los campos requeridos del borrador que `validatePaso1` no cubre
 * (modo/tipo/incoterm/descripción/origen/destino) fallan en el schema al
 * guardar; se marcan inline además de mostrar el toast.
 */
function marcarErroresGuardadoPaso1(
  form: UseFormReturn<CotizacionFormValues>,
  e: unknown,
): void {
  const issues = (e as { cause?: { issues?: { path?: unknown[]; message?: string }[] } })?.cause?.issues;
  if (!Array.isArray(issues)) return;
  for (const issue of issues) {
    const campo = campoParaPathSchemaPaso1(String(issue.path?.[0] ?? ""));
    if (campo && issue.message) {
      form.setError(campo as Path<CotizacionFormValues>, { type: "validate", message: issue.message });
    }
  }
}

interface Paso1Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<CotizacionRow>; isPending: boolean };
  updateCotizacion: {
    mutateAsync: (d: { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> }) => Promise<unknown>;
    isPending: boolean;
    /** P0: resincroniza el sello optimista tras el vínculo CRM (la RPC toca `updated_at`). */
    resincronizarSello?: (sello: string | null) => void;
  };
  registrarActividad: { mutate: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string; detalles?: Record<string, unknown> }) => void };
}

interface Paso1Deps {
  form: UseFormReturn<CotizacionFormValues>;
  cotizacionId: string | null;
  setCotizacionId: (id: string) => void;
  setCurrentStep: (step: number | ((p: number) => number)) => void;
  msdsFile: File | null;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: Paso1Mutations;
}

export function usePaso1Handlers({
  form, cotizacionId, setCotizacionId, setCurrentStep,
  msdsFile, buildPaso1Data, mutations,
}: Paso1Deps) {
  const { crearCotizacion, updateCotizacion, registrarActividad } = mutations;
  const enCurso = useRef(false);
  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (["clienteId", "esProspecto", "oportunidadId", "tarifaId"].includes(name ?? "")) limpiarIdentidadPricingObsoleta(form);
    });
    return () => subscription.unsubscribe();
  }, [form]);
  // P1-1: la tarifa ya cargada (panel) permite validar IDs de puerto vs tarifa.
  // En cache miss se consulta; si no se puede verificar, se bloquea (fail-closed).
  const validar = useCallback(async (v: CotizacionFormValues) =>
    validatePaso1(v) ?? (await errorCoherenciaEstricta(queryClient, v)), []);
  const { vincularCrm, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError } = useVinculoCrmPaso1(form, updateCotizacion, cotizacionId);

  /**
   * T-12: un solo toast resumen + error inline en el campo culpable, con
   * scroll/focus a su sección. Devuelve `true` si el paso 1 es inválido.
   */
  const marcarErrorPaso1 = useCallback((err: string): true => {
    const campo = campoParaErrorPaso1(err);
    if (campo) form.setError(campo, { type: "manual", message: err });
    notifyError(undefined, {
      title: campo ? "Revisa los campos marcados" : err,
      action: accionRecuperarCapturaPricing(form),
      description: campo ? err : undefined,
    });
    scrollAndFocusSection(seccionParaErrorPaso1(err));
    return true;
  }, [form]);

  const handlePaso1 = useCallback(async () => {
    if (form.getValues("pricingVinculoPendienteId") && form.getValues("sinDesgloseCostos")) { marcarErrorPaso1("Reintenta el vínculo con Cotizar sin desglose."); return; }
    if (enCurso.current) return;
    enCurso.current = true;
    try {
    const v = form.getValues();
    const err = await validar(v);
    if (err) { marcarErrorPaso1(err); return; }

    try {
      const id = await guardarPaso1Pricing(form, cotizacionId, () => savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } }));
      if (!cotizacionId) setCotizacionId(id);
      // Idempotente: se reintenta también en edición (no sólo al crear).
      if (!(await vincularCrm(id, v))) return;
      setCurrentStep(2);
    } catch (e: unknown) {
      marcarErroresGuardadoPaso1(form, e);
      notifyError(undefined, {
        title: "Error al guardar datos generales",
        action: accionRecuperarCapturaPricing(form),
        description: getErrorMessage(e),
        error: e,
        method: cotizacionId ? "UPDATE_DRAFT_COTIZACION" : "CREATE_DRAFT_COTIZACION",
        context: { cotizacionId, paso: 1 },
      });
    }
    } finally { enCurso.current = false; }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, setCotizacionId, setCurrentStep, marcarErrorPaso1, vincularCrm, validar]);
  /**
   * Atajo "Cotizar sin desglose": guarda Paso 1 con `sin_desglose_costos = true`
   * y salta directo al Paso 3 (Cotización Cliente). Bitácora: cotizacion_sin_desglose_creada.
   */
  const handleCotizarSinDesglose = useCallback(async () => {
    if (form.getValues("pricingVinculoPendienteId") && !form.getValues("sinDesgloseCostos")) { marcarErrorPaso1("Reintenta el vínculo con Siguiente antes de cambiar el desglose."); return; }
    if (enCurso.current) return;
    enCurso.current = true;
    try {
    const v = form.getValues();
    const err = await validar(v);
    if (err) { marcarErrorPaso1(err); return; }
    form.setValue("sinDesgloseCostos", true, { shouldDirty: true });
    try {
      const id = await guardarPaso1Pricing(form, cotizacionId, () => savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } }));
      if (!cotizacionId) setCotizacionId(id);
      if (!(await vincularCrm(id, v))) return;
      registrarActividad.mutate({
        accion: "cotizacion_sin_desglose_creada",
        modulo: "cotizaciones",
        entidad_id: id,
        entidad_nombre: "",
      });
      setCurrentStep(3);
    } catch (e: unknown) {
      marcarErroresGuardadoPaso1(form, e);
      notifyError(undefined, {
        title: "Error al guardar cotización",
        action: accionRecuperarCapturaPricing(form),
        description: getErrorMessage(e),
        error: e,
        method: "COTIZAR_SIN_DESGLOSE",
        context: { cotizacionId, paso: 1 },
      });
    }
    } finally { enCurso.current = false; }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, registrarActividad, setCotizacionId, setCurrentStep, marcarErrorPaso1, vincularCrm, validar]);

  const validarParaFinalizar = useCallback(async () => {
    const v = form.getValues();
    const pendiente = v.pricingVinculoPendienteId || (!v.esProspecto && v.pricingSolicitudId && !vinculoCrmConfirmado);
    const error = vinculoCrmError ?? (pendiente ? "Confirma el vínculo Pricing antes de finalizar." : await validar(v));
    if (!error) return true;
    marcarErrorPaso1(error);
    return false;
  }, [vinculoCrmError, vinculoCrmConfirmado, validar, form, marcarErrorPaso1]);

  return { validarParaFinalizar, handlePaso1, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError };
}
