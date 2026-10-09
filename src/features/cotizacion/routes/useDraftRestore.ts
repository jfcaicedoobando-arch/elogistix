/**
 * Lógica de detección/restauración del borrador de "Nueva cotización"
 * (extraída de `NuevaCotizacion.tsx` para mantenerlo bajo el límite
 * Power-of-10 de 200 líneas). Valida la captura antes de aplicarla.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";
import { loadDraft, clearDraft, draftTieneContenido } from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { fetchCotizacionDraftSnapshot } from "../services/draftSnapshot";
import { resolverContenidoBorrador } from "../hooks/wizard/resolverContenidoBorrador";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types/pl";

interface DraftRestoreDeps {
  form: UseFormReturn<CotizacionFormValues>;
  userId: string;
  organizationId: string | null | undefined;
  setCotizacionId: (id: string) => void;
  setCurrentStep: (step: number) => void;
  setCostosInternos: (c: FilaCostoLocal[]) => void;
  cotizacionId?: string | null;
  setConceptosUSD: (c: ConceptoVentaCotizacion[]) => void;
  setConceptosMXN: (c: ConceptoVentaCotizacion[]) => void;
  setTipoCambioUsd: (tc: number | null) => void;
  restaurarCostosSincronizados: (costos: FilaCostoLocal[]) => void;
  resincronizarSello: (sello: string | null) => void;
}

export function useDraftRestore({
  form, userId, organizationId, setCotizacionId, setCurrentStep,
  setCostosInternos, resincronizarSello, cotizacionId, setConceptosUSD, setConceptosMXN, setTipoCambioUsd, restaurarCostosSincronizados,
}: DraftRestoreDeps) {
  const [restaurando, setRestaurando] = useState(false);

  // P0 — Detectar borrador existente (re-evalúa cuando el userId async llega).
  // Sólo se ofrece restaurar si el borrador realmente tiene algo capturado:
  // sin esto, un draft "vacío" (valores por defecto) disparaba el banner igual.
  const draftDetectado = useMemo(() => {
    const draft = userId ? loadDraft(userId, organizationId) : null;
    if (!draft) return null;
    return draftTieneContenido(draft.values, draft.costosInternos, [...(draft.conceptosUSD ?? []), ...(draft.conceptosMXN ?? [])]) ? draft : null;
  }, [userId, organizationId]);
  const [banderaBorrador, setBanderaBorrador] = useState(false);
  // CRM-COT-01: la decisión sobre el borrador se resuelve explícitamente.
  // Antes se derivaba de `draftDetectado`, que sigue siendo truthy después de
  // descartar (es un memo del storage leído al montar), así que "Descartar"
  // dejaba la precarga desde una oportunidad bloqueada para siempre.
  const [decisionBorrador, setDecisionBorrador] =
    useState<"pendiente" | "restaurado" | "descartado">("pendiente");
  useEffect(() => {
    if (draftDetectado) {
      setBanderaBorrador(true);
      // Un borrador recién detectado (el userId asíncrono llega después) vuelve
      // a dejar la decisión en manos del usuario.
      setDecisionBorrador("pendiente");
    }
  }, [draftDetectado]);

  // v13.823.69: conflicto detectado al restaurar (otra sesión ya guardó).
  const [conflictoSello, setConflictoSello] = useState(false);
  const [resincronizando, setResincronizando] = useState(false);
  const requestRef = useRef(0);
  const restoringRef = useRef(false);
  const scope = `${organizationId ?? ""}:${userId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const idRef = useRef(cotizacionId);
  idRef.current = cotizacionId;
  useEffect(() => () => { requestRef.current += 1; restoringRef.current = false; }, [scope]);

  const handleRestore = useCallback(async () => {
    if (!draftDetectado || decisionBorrador !== "pendiente" || restoringRef.current) return;
    if (cotizacionId && cotizacionId !== draftDetectado.cotizacionId) return;
    restoringRef.current = true;
    const request = ++requestRef.current;
    const vigente = () => requestRef.current === request && scopeRef.current === scope && idRef.current === cotizacionId;
    setRestaurando(true);
    try {
      const snapshot = draftDetectado.cotizacionId && organizationId
        ? await fetchCotizacionDraftSnapshot(draftDetectado.cotizacionId, organizationId) : null;
      if (!vigente()) return;
      const contenido = resolverContenidoBorrador(draftDetectado, snapshot, organizationId);
      // Aplicar juntos sólo después de validar servidor, tenant e identidad.
      form.reset(draftDetectado.values);
      if (draftDetectado.cotizacionId) setCotizacionId(draftDetectado.cotizacionId);
      resincronizarSello(contenido.sello);
      setCurrentStep(contenido.currentStep);
      setCostosInternos(contenido.costosInternos);
      restaurarCostosSincronizados(contenido.costosSincronizados);
      setConceptosUSD(contenido.conceptosUSD);
      setConceptosMXN(contenido.conceptosMXN);
      setTipoCambioUsd(contenido.tipoCambioUsd);
      setConflictoSello(false);
      setBanderaBorrador(false);
      setDecisionBorrador("restaurado");
      if (draftDetectado.noRestaurado.length > 0) notifyWarning(undefined, {
        title: "Borrador restaurado parcialmente",
        description: `No se pudo recuperar: ${draftDetectado.noRestaurado.join("; ")}.`,
      });
    } catch (error) {
      if (!vigente()) return;
      setConflictoSello(true);
      notifyWarning(undefined, {
        title: "No se pudo restaurar el borrador",
        description: error instanceof Error ? error.message : "No se pudo consultar la cotización. El borrador local se conserva; vuelve a intentar.",
      });
    } finally {
      if (requestRef.current === request && scopeRef.current === scope) {
        restoringRef.current = false;
        setRestaurando(false);
      }
    }
  }, [draftDetectado, decisionBorrador, cotizacionId, scope, organizationId, form, setCotizacionId, resincronizarSello,
    setCurrentStep, setCostosInternos, setConceptosUSD, setConceptosMXN, setTipoCambioUsd, restaurarCostosSincronizados]);

  // Reintentar la misma comparación; jamás adoptar un sello nuevo sobre captura vieja.
  const handleResincronizar = useCallback(async () => {
    setResincronizando(true);
    try { await handleRestore(); } finally { setResincronizando(false); }
  }, [handleRestore]);

  const handleDiscard = useCallback(() => {
    requestRef.current += 1;
    restoringRef.current = false;
    setRestaurando(false);
    setConflictoSello(false);
    clearDraft(userId, organizationId);
    setBanderaBorrador(false);
    setDecisionBorrador("descartado");
  }, [userId, organizationId]);

  // Sólo se puede precargar una oportunidad del CRM cuando la identidad ya está
  // disponible (si no, aún podría aparecer un borrador) y no hay una decisión
  // pendiente. Al restaurar NUNCA se precarga: el borrador anterior se conserva
  // íntegro aunque todavía no tenga cotizacionId/clienteId/leadId.
  const permitePrefillProspecto =
    Boolean(userId) &&
    (draftDetectado === null ? true : decisionBorrador === "descartado") &&
    !restaurando;

  return {
    restaurando,
    pendienteBorrador: Boolean(draftDetectado) && decisionBorrador === "pendiente",
    draftDetectado,
    decisionBorrador,
    permitePrefillProspecto,
    banderaBorrador,
    conflictoSello,
    setConflictoSello,
    resincronizando,
    handleResincronizar,
    handleRestore,
    handleDiscard,
  };
}
