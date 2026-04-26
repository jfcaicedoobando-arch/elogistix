import { FormProvider } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { EmbarqueWizardLayout } from "@/components/embarque/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/components/embarque/StepDatosGenerales";
import { StepDatosRuta } from "@/components/embarque/StepDatosRuta";
import { StepDocumentos } from "@/components/embarque/StepDocumentos";
import { StepCostosPrecios } from "@/components/embarque/StepCostosPrecios";
import { useNuevoEmbarqueWizard } from "@/hooks/embarque/useNuevoEmbarqueWizard";

const steps = [
  { title: "Datos Generales", num: 1 },
  { title: "Datos de Ruta", num: 2 },
  { title: "Documentos", num: 3 },
  { title: "Costos y Pricing", num: 4 },
];

export default function NuevoEmbarque() {
  const navigate = useNavigate();
  const w = useNuevoEmbarqueWizard();

  return (
    <FormProvider {...w.methods}>
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
        validateStep={(step) => (step === 1 ? w.validateStep1() : true)}
      >
        {w.currentStep === 1 && (
          <StepDatosGenerales
            clientes={w.clientes}
            clienteNombre={w.selectedCliente?.nombre || ""}
            contactos={w.contactos}
            onMsdsUpload={w.handleMsdsUpload}
            errors={w.validationErrors}
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
        {w.currentStep === 2 && <StepDatosRuta />}
        {w.currentStep === 3 && (
          <StepDocumentos
            documentos={w.getDocumentosChecklist(w.modo)}
            onFileChange={w.setDocumentoArchivo}
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
          />
        )}
      </EmbarqueWizardLayout>
    </FormProvider>
  );
}
