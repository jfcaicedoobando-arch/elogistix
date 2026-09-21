/**
 * Controlador de página de "Nuevo embarque" (paso 5 auditoría).
 * Extrae de la ruta: acceso por cotización (state con precedencia sobre
 * `?fromCotizacion=`), redirect cuando falta cotización, autosave del
 * borrador, detección/restauración/descarte, conflicto entre pestañas y
 * limpieza del borrador tras un submit exitoso.
 *
 * La ruta queda sólo como composición/render. No cambia reglas fiscales,
 * permisos, navegación ni textos.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import { useEmbarqueDraftAutosave } from "@/features/embarques/hooks/wizard/useEmbarqueDraftAutosave";
import {
  loadEmbarqueDraft,
  clearEmbarqueDraft,
  embarqueDraftTieneContenido,
  EMBARQUE_DRAFT_NO_RESTAURADO,
  type StoredEmbarqueDraft,
} from "@/features/embarques/hooks/wizard/embarqueDraftStorage";
import { useNuevoEmbarqueWizard } from "./useNuevoEmbarqueWizard";

export interface NuevoEmbarquePageController {
  w: ReturnType<typeof useNuevoEmbarqueWizard>;
  llegaConCotizacion: boolean;
  draftDetectado: StoredEmbarqueDraft | null;
  banderaBorrador: boolean;
  conflictoExterno: boolean;
  descartarConflicto: () => void;
  handleRestore: () => void;
  handleDiscard: () => void;
  handleFinishConLimpieza: () => Promise<void>;
}

export function useNuevoEmbarquePageController(): NuevoEmbarquePageController {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // B-013 (v13.320.34): política tarifa-first honra tanto state como query
  // param `?fromCotizacion=…` (el diálogo post-guardado usa querystring).
  const cotizacionEntranteId =
    (location.state as { cotizacionPrevinculadaId?: string } | null)?.cotizacionPrevinculadaId
    ?? searchParams.get("fromCotizacion");
  const llegaConCotizacion = Boolean(cotizacionEntranteId);

  useEffect(() => {
    if (!llegaConCotizacion) {
      notifyError(undefined, { title: "Selecciona primero una cotización Aceptada para crear el embarque.", method: "FEATURES_EMBARQUES_ROUTES_NUEVOEMBARQUE_1" });
      // VB-36: el deep link /embarques/nuevo rebotaba a /cotizaciones sin
      // contexto; el state alimenta un banner persistente en el listado.
      navigate("/cotizaciones", { replace: true, state: { origen: "nuevo-embarque" } });
    }
  }, [llegaConCotizacion, navigate]);

  const w = useNuevoEmbarqueWizard();

  // ── M-13 (v14-2): borrador con TTL 24 h, espejo del wizard de cotización ──
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const userId = user?.id ?? "";
  const [restaurando, setRestaurando] = useState(false);
  const [banderaBorrador, setBanderaBorrador] = useState(false);

  const { clear: clearBorrador, conflictoExterno, descartarConflicto } = useEmbarqueDraftAutosave({
    form: w.methods,
    userId,
    organizationId,
    enabled: llegaConCotizacion,
    currentStep: w.currentStep,
    conceptosVenta: w.conceptosVenta,
    conceptosCosto: w.conceptosCosto,
    cotizacionVinculadaId: w.cotizacionVinculada?.id ?? null,
    paused: restaurando,
  });

  // Sólo se ofrece restaurar si el borrador pertenece a la misma cotización
  // de entrada (o a ninguna): mezclar cotizaciones corrompería la captura.
  const draftDetectado = useMemo(() => {
    const draft = userId ? loadEmbarqueDraft(userId, organizationId) : null;
    if (!draft) return null;
    if (draft.cotizacionVinculadaId && draft.cotizacionVinculadaId !== cotizacionEntranteId) return null;
    return embarqueDraftTieneContenido(draft.values, draft.conceptosVenta, draft.conceptosCosto) ? draft : null;
  }, [userId, organizationId, cotizacionEntranteId]);

  useEffect(() => {
    if (draftDetectado) setBanderaBorrador(true);
  }, [draftDetectado]);

  const handleRestore = useCallback(() => {
    if (!draftDetectado) return;
    // Congelamos el autosave mientras RHF aplica el reset (mismo patrón R-09).
    setRestaurando(true);
    // R201-COT-09: la vinculación se aplica ANTES del reset. Al vincular se
    // siembran los campos heredados de la cotización; si eso corriera después
    // pisaría lo capturado por el usuario y guardado en el borrador.
    if (draftDetectado.cotizacionVinculadaId) {
      const cot = w.cotizacionesAceptadas.find((c) => c.id === draftDetectado.cotizacionVinculadaId);
      if (cot) w.restaurarVinculacion(cot);
    }
    w.methods.reset(draftDetectado.values);
    w.setCurrentStep(draftDetectado.currentStep);
    if (draftDetectado.conceptosVenta.length > 0) w.setConceptosVenta(draftDetectado.conceptosVenta);
    if (draftDetectado.conceptosCosto.length > 0) w.setConceptosCosto(draftDetectado.conceptosCosto);
    notifyWarning(undefined, {
      title: "Borrador restaurado parcialmente",
      description: `No se pudo recuperar: ${EMBARQUE_DRAFT_NO_RESTAURADO.join("; ")}.`,
    });
    setBanderaBorrador(false);
    setTimeout(() => setRestaurando(false), 0);
  }, [draftDetectado, w]);

  const handleDiscard = useCallback(() => {
    clearEmbarqueDraft(userId, organizationId);
    setBanderaBorrador(false);
  }, [userId, organizationId]);

  const handleFinishConLimpieza = useCallback(async () => {
    const ok = await w.handleFinish();
    if (ok) clearBorrador();
  }, [w, clearBorrador]);

  return {
    w,
    llegaConCotizacion,
    draftDetectado,
    banderaBorrador,
    conflictoExterno,
    descartarConflicto,
    handleRestore,
    handleDiscard,
    handleFinishConLimpieza,
  };
}
