import { useCallback, useState } from "react";
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
  clearDraft,
} from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { ConflictoPestanaAlert } from "@/features/cotizacion/components/wizard/ConflictoPestanaAlert";
import { ConflictoSelloAlert } from "@/features/cotizacion/components/wizard/ConflictoSelloAlert";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { useDraftRestore } from "./useDraftRestore";
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

  const {
    restaurando, draftDetectado, banderaBorrador, conflictoSello,
    resincronizando, handleResincronizar, handleRestore, handleDiscard,
  } = useDraftRestore({
    form: w.form,
    userId,
    organizationId,
    setCotizacionId: w.setCotizacionId,
    setCurrentStep: w.setCurrentStep,
    setCostosInternos: w.setCostosInternos,
    resincronizarSello: w.resincronizarSello,
  });

  // B-003 (v13.320.32) — Autoguardado ahora persiste `cotizacionId` en el draft
  // para que recargar el wizard NO duplique la cotización. Antes se apagaba con
  // `enabled: !w.cotizacionId` y el id se perdía al recargar. Sólo se apaga en
  // modo edición (initialData) — aquí siempre es alta, así que enabled=true.
  const { flush: flushDraft, conflictoExterno, descartarConflicto } = useCotizacionDraftAutosave({
    form: w.form,
    userId,
    organizationId,
    enabled: true,
    cotizacionId: w.cotizacionId,
    currentStep: w.currentStep,
    costosInternos: w.costosInternos,
    // v13.823.69: el borrador guarda el sello optimista vigente.
    selloActual: w.selloActual,
    paused: restaurando,
  });

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

      {conflictoExterno && <ConflictoPestanaAlert onDescartar={descartarConflicto} />}

      {/* v13.823.69: el borrador se restauró pero la cotización ya cambió en
          servidor. Se conserva todo lo capturado y NO se guarda encima. */}
      {conflictoSello && (
        <ConflictoSelloAlert
          onRecargar={() => navigate(w.cotizacionId ? `/cotizaciones/${w.cotizacionId}/editar` : "/cotizaciones")}
          onResincronizar={handleResincronizar}
          resincronizando={resincronizando}
        />
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
