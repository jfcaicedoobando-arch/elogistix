/**
 * Handlers del Paso 1 del wizard de cotización (extraídos de
 * `useCotizacionWizardSteps` para mantenerlo bajo el límite Power-of-10
 * de 200 líneas). Ambos handlers comparten validación CRM, llamada a
 * `savePaso1` y vinculación CRM tras crear.
 */
import { useCallback, useState } from "react";
import type { Path, UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import type { CreateCotizacionInput, CotizacionRow } from "@/features/cotizacion/hooks/useCotizaciones";
import { savePaso1 } from "@/features/cotizacion/services";
import { getErrorMessage } from "@/lib/errors";
import { notifyError } from "@/lib/ui/appFeedback";
import { validatePaso1, vincularCrmTrasCrear, campoParaPathSchemaPaso1 } from "./handlePaso1Crm";
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
  // P0: si el vínculo CRM falla, el wizard NO avanza; se conserva la captura y
  // el mismo `cotizacionId` para reintentar sin duplicar nada.
  const [vinculoCrmError, setVinculoCrmError] = useState<string | null>(null);
  // Candado reactivo: al editar una cotización que ya trae oportunidad, y tras
  // el primer vínculo exitoso, el origen/destinatario deja de ser sustituible.
  const [vinculoCrmConfirmado, setVinculoCrmConfirmado] = useState<boolean>(
    () => Boolean(form.getValues("oportunidadId")),
  );

  const limpiarVinculoCrmError = useCallback(() => setVinculoCrmError(null), []);

  /**
   * Vincula la cotización de prospecto a su origen CRM. Devuelve `false` si
   * falló (el wizard debe quedarse en el paso 1).
   */
  const vincularCrm = useCallback(
    async (id: string, v: CotizacionFormValues): Promise<boolean> => {
      if (!v.esProspecto) return true;
      try {
        const res = await vincularCrmTrasCrear(id, v);
        // Los IDs canónicos son los que devuelve la RPC (no lo capturado).
        const opts = { shouldDirty: false, shouldValidate: true } as const;
        form.setValue("oportunidadId", res.oportunidadId ?? "", opts);
        form.setValue("leadId", res.leadId ?? "", { shouldDirty: false });
        updateCotizacion.resincronizarSello?.(res.updatedAt);
        setVinculoCrmError(null);
        setVinculoCrmConfirmado(true);
        return true;
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        setVinculoCrmError(msg);
        notifyError(undefined, {
          title: "Cotización guardada, pero falta el vínculo con el CRM",
          description: msg,
          error: e,
          method: "VINCULAR_OPORTUNIDAD_CRM",
          context: { cotizacionId: id, paso: 1 },
        });
        return false;
      }
    },
    [form, updateCotizacion],
  );



  /**
   * T-12: un solo toast resumen + error inline en el campo culpable, con
   * scroll/focus a su sección. Devuelve `true` si el paso 1 es inválido.
   */
  const marcarErrorPaso1 = useCallback((err: string): true => {
    const campo = campoParaErrorPaso1(err);
    if (campo) form.setError(campo, { type: "manual", message: err });
    notifyError(undefined, {
      title: campo ? "Revisa los campos marcados" : err,
      description: campo ? err : undefined,
    });
    scrollAndFocusSection(seccionParaErrorPaso1(err));
    return true;
  }, [form]);

  const handlePaso1 = useCallback(async () => {
    const v = form.getValues();
    const err = validatePaso1(v);
    if (err) { marcarErrorPaso1(err); return; }

    try {
      const id = await savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } });
      if (!cotizacionId) setCotizacionId(id);
      // Idempotente: se reintenta también en edición (no sólo al crear).
      if (!(await vincularCrm(id, v))) return;
      setCurrentStep(2);
    } catch (e: unknown) {
      marcarErroresGuardadoPaso1(form, e);
      notifyError(undefined, {
        title: "Error al guardar datos generales",
        description: getErrorMessage(e),
        error: e,
        method: cotizacionId ? "UPDATE_DRAFT_COTIZACION" : "CREATE_DRAFT_COTIZACION",
        context: { cotizacionId, paso: 1 },
      });
    }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, setCotizacionId, setCurrentStep, marcarErrorPaso1, vincularCrm]);

  /**
   * Atajo "Cotizar sin desglose": guarda Paso 1 con `sin_desglose_costos = true`
   * y salta directo al Paso 3 (Cotización Cliente). Bitácora: cotizacion_sin_desglose_creada.
   */
  const handleCotizarSinDesglose = useCallback(async () => {
    const v = form.getValues();
    const err = validatePaso1(v);
    if (err) { marcarErrorPaso1(err); return; }
    form.setValue("sinDesgloseCostos", true, { shouldDirty: true });
    try {
      const id = await savePaso1({ form, msdsFile, cotizacionId, buildPaso1Data, mutations: { crearCotizacion, updateCotizacion } });
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
        description: getErrorMessage(e),
        error: e,
        method: "COTIZAR_SIN_DESGLOSE",
        context: { cotizacionId, paso: 1 },
      });
    }
  }, [form, msdsFile, cotizacionId, buildPaso1Data, crearCotizacion, updateCotizacion, registrarActividad, setCotizacionId, setCurrentStep, marcarErrorPaso1, vincularCrm]);

  return { handlePaso1, handleCotizarSinDesglose, vinculoCrmError, vinculoCrmConfirmado, limpiarVinculoCrmError };
}
