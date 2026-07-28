import { useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { EmbarqueWizardLayout } from "@/features/embarques/components/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/features/embarques/components/StepDatosGenerales";
import { StepDatosRuta } from "@/features/embarques/components/StepDatosRuta";
import { StepDocumentos } from "@/features/embarques/components/StepDocumentos";
import { StepCostosPrecios } from "@/features/embarques/components/StepCostosPrecios";
import { useNuevoEmbarqueWizard } from "@/features/embarques/hooks";
import { CotizacionVinculadaProvider } from "@/features/embarques/hooks/useHeredadoCotizacion";

import { notifyError } from "@/lib/ui/appFeedback";
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
  const llegaConCotizacion =
    Boolean((location.state as { cotizacionPrevinculadaId?: string } | null)?.cotizacionPrevinculadaId)
    || Boolean(searchParams.get("fromCotizacion"));

  useEffect(() => {
    if (!llegaConCotizacion) {
      notifyError(undefined, { title: "Selecciona primero una cotización Aceptada para crear el embarque.", method: "FEATURES_EMBARQUES_ROUTES_NUEVOEMBARQUE_1" });
      navigate("/cotizaciones", { replace: true });
    }
  }, [llegaConCotizacion, navigate]);

  const w = useNuevoEmbarqueWizard();

  return (
    <FormProvider {...w.methods}>
      <CotizacionVinculadaProvider cotizacion={w.cotizacionVinculada}>
      <EmbarqueWizardLayout
        title="Nuevo Embarque"
        subtitle="Completa los datos para registrar un embarque"
        steps={steps}
        currentStep={w.currentStep}
        setCurrentStep={w.setCurrentStep}
        totalSteps={4}
        isPending={w.isPending}
        saveLabel="Crear Embarque"
        onBack={() => navigate("/embarques")}
        onFinish={w.handleFinish}
        validateStep={(step) => w.validateStep(step)}
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
      </EmbarqueWizardLayout>
      </CotizacionVinculadaProvider>
    </FormProvider>
  );
}
