import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useEditarEmbarqueWizard } from "@/features/embarques/hooks";
import { EmbarqueWizardLayout } from "@/features/embarques/components/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/features/embarques/components/StepDatosGenerales";
import { StepDatosRuta } from "@/features/embarques/components/StepDatosRuta";
import { StepCostosPrecios } from "@/features/embarques/components/StepCostosPrecios";

const steps = [
  { title: 'Datos Generales', num: 1 },
  { title: 'Datos de Ruta', num: 2 },
  { title: 'Costos y Pricing', num: 3 },
];

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";

export default function EditarEmbarque() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const {
    embarque, isLoading, methods, currentStep, setCurrentStep,
    clientes, proveedoresDb, contactos, selectedCliente,
    handleMsdsUpload, handleSave, isPending, navigate, conceptosForm,
  } = useEditarEmbarqueWizard(id);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  useEffect(() => {
    const raw = searchParams.get("step");
    const n = raw ? Number(raw) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= 3) setCurrentStep(n);
  }, [searchParams, setCurrentStep]);
  useRegisterBreadcrumbLabel(id, embarque?.expediente);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
  } = conceptosForm;

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        <SkeletonGroup className="flex-none border-b bg-background p-4 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-full" />
        </SkeletonGroup>
        <div className="flex-1 overflow-y-auto p-4">
          <SkeletonGroup className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </SkeletonGroup>
        </div>
      </div>
    );
  }

  if (!embarque) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/embarques")}>Volver</Button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <EmbarqueWizardLayout
        title={`Editar embarque ${embarque.expediente}`}
        subtitle="Modifica los datos generales, ruta y costos del embarque"
        steps={steps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        totalSteps={3}
        isPending={isPending}
        saveLabel="Guardar Cambios"
        onBack={() => navigate(`/embarques/${id}`)}
        onFinish={handleSave}
      >
        {currentStep === 1 && (
          <StepDatosGenerales
            clientes={clientes}
            clienteNombre={selectedCliente?.nombre || ''}
            contactos={contactos}
            onMsdsUpload={handleMsdsUpload}
          />
        )}
        {currentStep === 2 && <StepDatosRuta />}
        {currentStep === 3 && (
          <StepCostosPrecios
            conceptosVenta={conceptosVenta}
            conceptosCosto={conceptosCosto}
            proveedoresDb={proveedoresDb}
            subtotalVenta={subtotalVenta}
            totalCosto={totalCosto}
            utilidadEstimada={utilidadEstimada}
            updateConceptoVenta={updateConceptoVenta}
            addConceptoVenta={addConceptoVenta}
            removeConceptoVenta={removeConceptoVenta}
            updateConceptoCosto={updateConceptoCosto}
            addConceptoCosto={addConceptoCosto}
            removeConceptoCosto={removeConceptoCosto}
            embarqueId={id}
          />
        )}
      </EmbarqueWizardLayout>
    </FormProvider>
  );
}
