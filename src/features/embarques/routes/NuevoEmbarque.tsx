import { FormProvider } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { EmbarqueWizardLayout } from "@/features/embarques/components/EmbarqueWizardLayout";
import { NuevoEmbarquePasos } from "@/features/embarques/components/NuevoEmbarquePasos";
import { useNuevoEmbarquePageController } from "@/features/embarques/hooks/useNuevoEmbarquePageController";
import { CotizacionVinculadaProvider } from "@/features/embarques/hooks/useHeredadoCotizacion";
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
  const {
    w,
    draftDetectado,
    banderaBorrador,
    conflictoExterno,
    descartarConflicto,
    handleRestore,
    handleDiscard,
    handleFinishConLimpieza,
  } = useNuevoEmbarquePageController();

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
        <NuevoEmbarquePasos w={w} />
        </AsyncBoundary>
      </EmbarqueWizardLayout>
      </CotizacionVinculadaProvider>
    </FormProvider>
  );
}
