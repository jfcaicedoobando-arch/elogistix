import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgActiva } from "@/hooks/shared/useOrgActiva";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { useEmbarqueDraftAutosave } from "@/features/embarques/hooks/wizard/useEmbarqueDraftAutosave";
import {
  loadEmbarqueDraft,
  clearEmbarqueDraft,
  embarqueDraftTieneContenido,
  EMBARQUE_DRAFT_NO_RESTAURADO,
} from "@/features/embarques/hooks/wizard/embarqueDraftStorage";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { EmbarqueWizardLayout } from "@/features/embarques/components/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/features/embarques/components/StepDatosGenerales";
import { StepDatosRuta } from "@/features/embarques/components/StepDatosRuta";
import { StepDocumentos } from "@/features/embarques/components/StepDocumentos";
import { StepCostosPrecios } from "@/features/embarques/components/StepCostosPrecios";
import { useNuevoEmbarqueWizard } from "@/features/embarques/hooks";
import { CotizacionVinculadaProvider } from "@/features/embarques/hooks/useHeredadoCotizacion";

import { notifyError } from "@/lib/ui/appFeedback";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
const steps = [
  { title: "Datos Generales", num: 1 },
  { title: "Datos de Ruta", num: 2 },
  { title: "Documentos", num: 3 },
  { title: "Costos y Pricing", num: 4 },
];

export default function NuevoEmbarque() {
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
    w.methods.reset(draftDetectado.values);
    w.setCurrentStep(draftDetectado.currentStep);
    if (draftDetectado.conceptosVenta.length > 0) w.setConceptosVenta(draftDetectado.conceptosVenta);
    if (draftDetectado.conceptosCosto.length > 0) w.setConceptosCosto(draftDetectado.conceptosCosto);
    if (draftDetectado.cotizacionVinculadaId) {
      const cot = w.cotizacionesAceptadas.find((c) => c.id === draftDetectado.cotizacionVinculadaId);
      if (cot) w.restaurarVinculacion(cot);
    }
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

  return (
    <FormProvider {...w.methods}>
      <CotizacionVinculadaProvider cotizacion={w.cotizacionVinculada}>
      {banderaBorrador && draftDetectado && (
        <DraftRestoreBanner
          savedAt={draftDetectado.savedAt}
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      )}
      {conflictoExterno && (
        <Alert className="border-warning/40 bg-warning/5 mb-4">
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
      )}
      <EmbarqueWizardLayout
        title="Nuevo embarque"
        subtitle="Completa los datos para registrar un embarque"
        steps={steps}
        currentStep={w.currentStep}
        setCurrentStep={w.setCurrentStep}
        totalSteps={4}
        isPending={w.isPending}
        saveLabel="Crear embarque"
        onBack={() => navigate("/embarques")}
        onFinish={() => { void handleFinishConLimpieza(); }}
        validateStep={(step) => w.validateStep(step)}
        // RFE-06 (Ola 11): dirty real de react-hook-form — capturar el paso 1
        // y salir ahora SÍ avisa. La heurística por paso se conserva como red
        // para el contenido fuera de RHF (documentos paso 3, conceptos paso 4).
        isDirty={w.methods.formState.isDirty || w.currentStep > 1}
      >
        <AsyncBoundary
          isLoading={w.catalogosCargando}
          isError={w.catalogosError}
          onRetry={w.recargarCatalogos}
          skeleton={<ListSkeleton rows={5} />}
          errorTitle="No se pudieron cargar los catálogos"
          errorDescription="Sin clientes, proveedores y cotizaciones no podemos abrir el wizard. Reintenta."
        >
        {w.currentStep === 1 && (
          <StepDatosGenerales
            clientes={w.clientes}
            clienteNombre={w.selectedCliente?.nombre || ""}
            contactos={w.contactos}
            onMsdsUpload={w.handleMsdsUpload}
            errors={w.validationErrors[1] || {}}
            cotizacionesAceptadas={w.cotizacionesAceptadas}
            cotizacionVinculada={w.cotizacionVinculada}
            onVincularCotizacion={w.handleVincularCotizacion}
            onDesvincularCotizacion={w.handleDesvincularCotizacion}
            modoExpediente={w.modoExpediente}
            onModoExpedienteChange={w.handleModoExpedienteChange}
            expedienteSeleccionado={w.expedienteSeleccionado}
            onSeleccionarExpediente={w.handleSeleccionarExpediente}
          />
        )}
        {w.currentStep === 2 && (
          <StepDatosRuta
            errors={w.validationErrors[2] || {}}
            diasTransitoSugerencia={w.cotizacionVinculada?.tiempo_transito_dias ?? null}
          />
        )}
        {w.currentStep === 3 && (
          <StepDocumentos
            documentos={w.getDocumentosChecklist(w.modo)}
            onFileChange={w.setDocumentoArchivo}
            errors={w.validationErrors[3] || {}}
          />
        )}
        {w.currentStep === 4 && (
          <StepCostosPrecios
            conceptosVenta={w.conceptosVenta}
            conceptosCosto={w.conceptosCosto}
            proveedoresDb={w.proveedoresDb}
            subtotalVenta={w.subtotalVenta}
            totalCosto={w.totalCosto}
            utilidadEstimada={w.utilidadEstimada}
            updateConceptoVenta={w.updateConceptoVenta}
            addConceptoVenta={w.addConceptoVenta}
            removeConceptoVenta={w.removeConceptoVenta}
            updateConceptoCosto={w.updateConceptoCosto}
            addConceptoCosto={w.addConceptoCosto}
            removeConceptoCosto={w.removeConceptoCosto}
            errors={w.validationErrors[4] || {}}
          />
        )}
        </AsyncBoundary>
      </EmbarqueWizardLayout>
      </CotizacionVinculadaProvider>
    </FormProvider>
  );
}
