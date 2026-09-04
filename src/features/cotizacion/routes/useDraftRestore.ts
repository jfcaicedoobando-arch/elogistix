/**
 * Lógica de detección/restauración del borrador de "Nueva cotización"
 * (extraída de `NuevaCotizacion.tsx` para mantenerlo bajo el límite
 * Power-of-10 de 200 líneas). No cambia comportamiento.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";
import { loadDraft, clearDraft, draftTieneContenido } from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { fetchCotizacionSello } from "@/features/cotizacion/services";
import { resolverSelloBorrador, resincronizarSelloConflicto } from "@/features/cotizacion/hooks/wizard/resolverSelloBorrador";
import { notifyInfo, notifyWarning } from "@/lib/ui/appFeedback";
import type { FilaCostoLocal } from "@/features/cotizacion/types/pl";

interface DraftRestoreDeps {
  form: UseFormReturn<CotizacionFormValues>;
  userId: string;
  organizationId: string | null | undefined;
  setCotizacionId: (id: string) => void;
  setCurrentStep: (step: number) => void;
  setCostosInternos: (c: FilaCostoLocal[]) => void;
  resincronizarSello: (sello: string | null) => void;
}

export function useDraftRestore({
  form, userId, organizationId, setCotizacionId, setCurrentStep,
  setCostosInternos, resincronizarSello,
}: DraftRestoreDeps) {
  const [restaurando, setRestaurando] = useState(false);

  // P0 — Detectar borrador existente (re-evalúa cuando el userId async llega).
  // Sólo se ofrece restaurar si el borrador realmente tiene algo capturado:
  // sin esto, un draft "vacío" (valores por defecto) disparaba el banner igual.
  const draftDetectado = useMemo(() => {
    const draft = userId ? loadDraft(userId, organizationId) : null;
    if (!draft) return null;
    return draftTieneContenido(draft.values, draft.costosInternos) ? draft : null;
  }, [userId, organizationId]);
  const [banderaBorrador, setBanderaBorrador] = useState(false);
  useEffect(() => {
    if (draftDetectado) setBanderaBorrador(true);
  }, [draftDetectado]);

  // v13.823.69: conflicto detectado al restaurar (otra sesión ya guardó).
  const [conflictoSello, setConflictoSello] = useState(false);
  // P0-12: id vigente para poder resincronizar sin depender de `draftDetectado`
  // (que se limpia tras restaurar).
  const [cotizacionIdConflicto, setCotizacionIdConflicto] = useState<string | null>(null);
  const [resincronizando, setResincronizando] = useState(false);

  const handleRestore = useCallback(async () => {
    if (draftDetectado) {
      // R-09: congelamos el autoguardado mientras RHF aplica el reset.
      setRestaurando(true);
      form.reset(draftDetectado.values);
      // B-003: restaurar el id garantiza que el siguiente "Guardar" haga UPDATE
      // en la cotización huérfana en vez de INSERTar una nueva.
      if (draftDetectado.cotizacionId) {
        setCotizacionId(draftDetectado.cotizacionId);
        // Antes de permitir cualquier UPDATE se valida el sello canónico: sin
        // esto el candado quedaba en null y el guardado pasaba en silencio.
        const { sello, conflicto } = await resolverSelloBorrador({
          cotizacionId: draftDetectado.cotizacionId,
          selloDraft: draftDetectado.updatedAt,
          fetchSello: fetchCotizacionSello,
        });
        resincronizarSello(sello);
        setConflictoSello(conflicto);
        setCotizacionIdConflicto(draftDetectado.cotizacionId);
      }
      // Q-12: restaurar paso y costos internos (viven fuera de RHF).
      setCurrentStep(draftDetectado.currentStep);
      setCostosInternos(draftDetectado.costosInternos);
      if (draftDetectado.noRestaurado.length > 0) {
        notifyWarning(undefined, {
          title: "Borrador restaurado parcialmente",
          description: `No se pudo recuperar: ${draftDetectado.noRestaurado.join("; ")}.`,
        });
      }
    }
    setBanderaBorrador(false);
    // Se reanuda en el siguiente tick, ya con los valores restaurados aplicados.
    setTimeout(() => setRestaurando(false), 0);
  }, [draftDetectado, form, setCotizacionId, resincronizarSello, setCurrentStep, setCostosInternos]);

  // P0-12: "Resincronizar" — vuelve a leer el sello canónico antes de
  // levantar el bloqueo. Si sigue sin poder leerse (o la fila ya no existe),
  // el candado permanece cerrado y se explica al usuario qué pasó.
  const handleResincronizar = useCallback(async () => {
    if (!cotizacionIdConflicto || resincronizando) return;
    setResincronizando(true);
    try {
      const { sello, conflicto } = await resincronizarSelloConflicto({
        cotizacionId: cotizacionIdConflicto,
        fetchSello: fetchCotizacionSello,
      });
      resincronizarSello(sello);
      setConflictoSello(conflicto);
      if (conflicto) {
        notifyWarning(undefined, {
          title: "No se pudo confirmar la versión actual",
          description: "La cotización no se pudo leer (permisos, red o fue eliminada). El guardado sigue bloqueado; intenta de nuevo en un momento.",
        });
      } else {
        notifyInfo(undefined, {
          title: "Versión actualizada",
          description: "Se leyó la versión más reciente de la cotización. Ya puedes continuar guardando sobre ella.",
        });
      }
    } finally {
      setResincronizando(false);
    }
  }, [cotizacionIdConflicto, resincronizando, resincronizarSello]);

  const handleDiscard = useCallback(() => {
    clearDraft(userId, organizationId);
    setBanderaBorrador(false);
  }, [userId, organizationId]);

  return {
    restaurando,
    draftDetectado,
    banderaBorrador,
    conflictoSello,
    setConflictoSello,
    resincronizando,
    handleResincronizar,
    handleRestore,
    handleDiscard,
  };
}
