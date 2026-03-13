import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useProveedoresForSelect,
  useUpdateEmbarque,
} from "@/hooks/useEmbarques";
import { useClientesForSelect, useContactosCliente } from "@/hooks/useClientes";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useConceptosForm } from "@/hooks/useConceptosForm";
import { useEmbarqueForm } from "@/hooks/useEmbarqueForm";
import { getErrorMessage } from "@/lib/errorUtils";
import { EmbarqueWizardLayout } from "@/components/embarque/EmbarqueWizardLayout";
import { StepDatosGenerales } from "@/components/embarque/StepDatosGenerales";
import { StepDatosRuta } from "@/components/embarque/StepDatosRuta";
import { StepCostosPrecios } from "@/components/embarque/StepCostosPrecios";

const steps = [
  { title: 'Datos Generales', num: 1 },
  { title: 'Datos de Ruta', num: 2 },
  { title: 'Costos y Pricing', num: 3 },
];

export default function EditarEmbarque() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVentaDb = [], isLoading: cargandoVenta } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCostoDb = [], isLoading: cargandoCosto } = useEmbarqueConceptosCosto(id);
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  const updateEmbarque = useUpdateEmbarque();
  const registrarActividad = useRegistrarActividad();

  const [initialized, setInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const { methods, handleMsdsUpload, inicializarDesdeEmbarque, buildEmbarquePayload, buildConceptosVentaPayload, buildConceptosCostoPayload } = useEmbarqueForm();
  const clienteId = methods.watch('clienteId');
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const {
    conceptosVenta, conceptosCosto,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
    subtotalVenta, totalCosto, utilidadEstimada,
    inicializarVenta, inicializarCosto,
  } = useConceptosForm();

  useEffect(() => {
    if (!embarque || initialized) return;
    inicializarDesdeEmbarque(embarque);
    setInitialized(true);
  }, [embarque, initialized]);

  useEffect(() => {
    if (!initialized || conceptosVentaDb.length === 0) return;
    inicializarVenta(conceptosVentaDb.map((v, i) => ({
      id: i + 1,
      concepto: v.descripcion,
      cantidad: v.cantidad,
      precioUnitario: Number(v.precio_unitario),
      moneda: v.moneda,
    })));
  }, [conceptosVentaDb, initialized]);

  useEffect(() => {
    if (!initialized || conceptosCostoDb.length === 0) return;
    inicializarCosto(conceptosCostoDb.map((c, i) => ({
      id: i + 1,
      proveedorId: c.proveedor_id ?? '',
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
    })));
  }, [conceptosCostoDb, initialized]);

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const handleSave = async () => {
    if (!id || !embarque) return;
    try {
      await updateEmbarque.mutateAsync({
        id,
        embarque: buildEmbarquePayload(contactos, selectedCliente?.nombre || '', user?.email || ''),
        conceptosVenta: buildConceptosVentaPayload(conceptosVenta),
        conceptosCosto: buildConceptosCostoPayload(conceptosCosto, proveedoresDb),
      });

      const v = methods.getValues();
      registrarActividad.mutate({
        accion: 'editar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: embarque.expediente,
        detalles: { cliente: selectedCliente?.nombre ?? '', modo: v.modo, tipo: v.tipo },
      });

      toast({ title: "Embarque actualizado", description: `${embarque.expediente} guardado correctamente.` });
      navigate(`/embarques/${id}`);
    } catch (err: unknown) {
      toast({ title: "Error al actualizar", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (isLoading || cargandoVenta || cargandoCosto) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        <div className="flex-none border-b bg-background p-4 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
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
        title="Editar Embarque"
        subtitle={embarque.expediente}
        steps={steps}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        totalSteps={3}
        isPending={updateEmbarque.isPending}
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
          />
        )}
      </EmbarqueWizardLayout>
    </FormProvider>
  );
}
