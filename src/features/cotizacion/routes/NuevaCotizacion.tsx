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
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { CotizacionSuccessDialog } from "@/features/cotizacion/components/wizard/CotizacionSuccessDialog";

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();
  const userId = user?.id ?? "";

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

  // P0 — Autoguardado de borrador. Sólo mientras estamos en el paso 1
  // (aún no hay cotizacionId persistido en BD).
  useCotizacionDraftAutosave({
    form: w.form,
    userId,
    enabled: !w.cotizacionId,
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
    }
    setBanderaBorrador(false);
  }, [draftDetectado, w.form]);

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

      <CotizacionWizardLayout
        w={w}
        clientes={clientes}
        title="Nueva Cotización"
        subtitle="Completa los datos para crear una cotización"
        onBack={() => navigate("/cotizaciones")}
        saveLabel="Guardar Cotización"
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
      />
    </>
  );
}
