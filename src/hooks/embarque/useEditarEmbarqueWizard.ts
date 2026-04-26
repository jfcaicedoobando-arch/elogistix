import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
import { getErrorMessage } from "@/lib/errors";

/**
 * Controller hook para la página EditarEmbarque.
 * Encapsula carga del embarque, hidratación de formularios, y submit.
 */
export function useEditarEmbarqueWizard(id: string | undefined) {
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

  const {
    methods,
    handleMsdsUpload,
    inicializarDesdeEmbarque,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
  } = useEmbarqueForm();
  const clienteId = methods.watch('clienteId');
  const { data: contactos = [] } = useContactosCliente(clienteId || undefined);

  const conceptosForm = useConceptosForm();
  const {
    conceptosVenta, conceptosCosto,
    inicializarVenta, inicializarCosto,
  } = conceptosForm;

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

  return {
    embarque,
    isLoading: isLoading || cargandoVenta || cargandoCosto,
    methods,
    currentStep,
    setCurrentStep,
    clientes,
    proveedoresDb,
    contactos,
    selectedCliente,
    handleMsdsUpload,
    handleSave,
    isPending: updateEmbarque.isPending,
    navigate,
    conceptosForm,
  };
}
