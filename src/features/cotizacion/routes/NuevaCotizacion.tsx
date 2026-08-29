import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { useCreateCotizacion, useUpdateCotizacion } from "@/features/cotizacion/hooks";
import { useUpsertCotizacionCostos } from "@/features/cotizacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCotizacionWizardForm } from "@/features/cotizacion/hooks";
import CotizacionWizardLayout from "@/features/cotizacion/components/CotizacionWizardLayout";
import {
  useCotizacionDraftAutosave,
  loadDraft,
  clearDraft,
  draftTieneContenido,
} from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { CotizacionSuccessDialog } from "@/features/cotizacion/components/wizard/CotizacionSuccessDialog";
import { GuardarPlantillaDialog } from "@/features/cotizacion/components/wizard/GuardarPlantillaDialog";
import { PlantillaSelectorPaso1 } from "@/features/cotizacion/components/wizard/PlantillaSelectorPaso1";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { PageContainer } from "@/components/shared/PageContainer";
import { useDocumentTitle } from "@/hooks/shared";



export default function NuevaCotizacion() {
  useDocumentTitle("Nueva cotización");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organizationId } = useOrgActiva();
  const { data: clientes = [] } = useClientesForSelect();
  const userId = user?.id ?? "";

  // P2 (v13.295.0) — Guardar como plantilla desde el success dialog.
  const [guardarPlantillaOpen, setGuardarPlantillaOpen] = useState(false);


  // P0 — Success dialog post-guardado.
  const [savedId, setSavedId] = useState<string | null>(null);
  const handleFinalized = useCallback((id: string) => {
    setSavedId(id);
    clearDraft(userId, organizationId);
  }, [userId, organizationId]);

  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail: user?.email ?? "",
    clientes,
    mutations: {
      crearCotizacion: useCreateCotizacion(),
      updateCotizacion: useUpdateCotizacion(),
      upsertCostos: useUpsertCotizacionCostos(),
      registrarActividad: useRegistrarActividad(),
    },
    onFinalized: handleFinalized,
  });

  // B-003 (v13.320.32) — Autoguardado ahora persiste `cotizacionId` en el draft
  // para que recargar el wizard NO duplique la cotización. Antes se apagaba con
  // `enabled: !w.cotizacionId` y el id se perdía al recargar. Sólo se apaga en
  // modo edición (initialData) — aquí siempre es alta, así que enabled=true.
  const [restaurando, setRestaurando] = useState(false);

  const { flush: flushDraft, conflictoExterno, descartarConflicto } = useCotizacionDraftAutosave({
    form: w.form,
    userId,
    organizationId,
    enabled: true,
    cotizacionId: w.cotizacionId,
    currentStep: w.currentStep,
    costosInternos: w.costosInternos,
    paused: restaurando,
  });

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

  const handleRestore = useCallback(() => {
    if (draftDetectado) {
      // R-09: congelamos el autoguardado mientras RHF aplica el reset.
      setRestaurando(true);
      w.form.reset(draftDetectado.values);
      // B-003: restaurar el id garantiza que el siguiente "Guardar" haga UPDATE
      // en la cotización huérfana en vez de INSERTar una nueva.
      if (draftDetectado.cotizacionId) {
        w.setCotizacionId(draftDetectado.cotizacionId);
      }
      // Q-12: restaurar paso y costos internos (viven fuera de RHF).
      w.setCurrentStep(draftDetectado.currentStep);
      w.setCostosInternos(draftDetectado.costosInternos);
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
  }, [draftDetectado, w]);

  const handleDiscard = useCallback(() => {
    clearDraft(userId, organizationId);
    setBanderaBorrador(false);
  }, [userId, organizationId]);

  const closeSuccessAndGoTo = useCallback((to: string) => {
    setSavedId(null);
    navigate(to);
  }, [navigate]);

  return (
    <>
      {banderaBorrador && draftDetectado && (
        <PageContainer noSpacing className="max-w-6xl pt-4">
          {/* UI-08: wrapper estándar PageContainer (antes div ad-hoc max-w-6xl). */}
          <DraftRestoreBanner
            savedAt={draftDetectado.savedAt}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
          />
        </PageContainer>
      )}

      {/* M-12 (v14-2): otra pestaña está capturando el mismo wizard; avisar
          en vez de dejar que el autoguardado se pise en silencio. */}
      {conflictoExterno && (
        <PageContainer noSpacing className="max-w-6xl pt-4">
          <Alert className="border-warning/40 bg-warning/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-body-sm flex items-center justify-between gap-2">
              <span>
                <strong>Tienes este wizard abierto en otra pestaña</strong> y acaba de guardar
                cambios ahí. Para no mezclar capturas, trabaja en una sola pestaña.
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={descartarConflicto}>
                Entendido
              </Button>
            </AlertDescription>
          </Alert>
        </PageContainer>
      )}

      {/* P2 (v13.295.0) — Empezar desde plantilla (sólo paso 1, sin cotización guardada). */}
      {w.currentStep === 1 && !w.cotizacionId && (
        <PlantillaSelectorPaso1
          organizationId={organizationId}
          form={w.form}
        />
      )}



      <CotizacionWizardLayout
        w={w}
        clientes={clientes}
        title="Nueva cotización"
        subtitle="Completa los datos para crear una cotización"
        onBack={() => navigate("/cotizaciones")}
        saveLabel="Guardar cotización"
        onFlushDraft={flushDraft}
      />

      <CotizacionSuccessDialog
        open={!!savedId}
        onOpenChange={(o) => { if (!o) setSavedId(null); }}
        folio={null}
        onEnviarProforma={() => savedId && closeSuccessAndGoTo(`/cotizaciones/${savedId}?enviarProforma=1`)}
        onCrearEmbarque={() => savedId && closeSuccessAndGoTo(`/embarques/nuevo?fromCotizacion=${savedId}`)}
        onDuplicar={() => savedId && closeSuccessAndGoTo(`/cotizaciones/nueva?duplicar=${savedId}`)}
        onIrAlListado={() => closeSuccessAndGoTo("/cotizaciones")}
        onVerDetalle={() => savedId && closeSuccessAndGoTo(`/cotizaciones/${savedId}`)}
        onGuardarComoPlantilla={() => setGuardarPlantillaOpen(true)}
      />

      <GuardarPlantillaDialog
        open={guardarPlantillaOpen}
        onOpenChange={setGuardarPlantillaOpen}
        organizationId={organizationId}
        usuarioId={userId || null}
        values={w.form.getValues()}
      />


    </>
  );
}
