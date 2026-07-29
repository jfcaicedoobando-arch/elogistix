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
} from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { CotizacionSuccessDialog } from "@/features/cotizacion/components/wizard/CotizacionSuccessDialog";
import { GuardarPlantillaDialog } from "@/features/cotizacion/components/wizard/GuardarPlantillaDialog";
import { PlantillaSelectorPaso1 } from "@/features/cotizacion/components/wizard/PlantillaSelectorPaso1";



export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, organizationId } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const userId = user?.id ?? "";

  // P2 (v13.295.0) — Guardar como plantilla desde el success dialog.
  const [guardarPlantillaOpen, setGuardarPlantillaOpen] = useState(false);


  // P0 — Success dialog post-guardado.
  const [savedId, setSavedId] = useState<string | null>(null);
  const handleFinalized = useCallback((id: string) => {
    setSavedId(id);
    clearDraft(userId);
  }, [userId]);

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
  const { flush: flushDraft } = useCotizacionDraftAutosave({
    form: w.form,
    userId,
    enabled: true,
    cotizacionId: w.cotizacionId,
    currentStep: w.currentStep,
    costosInternos: w.costosInternos,
  });

  // P0 — Detectar borrador existente (re-evalúa cuando el userId async llega).
  const draftDetectado = useMemo(() => (userId ? loadDraft(userId) : null), [userId]);
  const [banderaBorrador, setBanderaBorrador] = useState(false);
  useEffect(() => {
    if (draftDetectado) setBanderaBorrador(true);
  }, [draftDetectado]);

  const handleRestore = useCallback(() => {
    if (draftDetectado) {
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
  }, [draftDetectado, w]);

  const handleDiscard = useCallback(() => {
    clearDraft(userId);
    setBanderaBorrador(false);
  }, [userId]);

  const closeSuccessAndGoTo = useCallback((to: string) => {
    setSavedId(null);
    navigate(to);
  }, [navigate]);

  return (
    <>
      {banderaBorrador && draftDetectado && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <DraftRestoreBanner
            savedAt={draftDetectado.savedAt}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
          />
        </div>
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
        title="Nueva Cotización"
        subtitle="Completa los datos para crear una cotización"
        onBack={() => navigate("/cotizaciones")}
        saveLabel="Guardar Cotización"
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
