import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useProveedoresForSelect,
  useUpdateEmbarque,
} from "@/features/embarques/hooks/useEmbarques";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import { useClientesForSelect, useContactosCliente } from "@/features/cliente/hooks/useClientes";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import {
  useConceptosForm,
  useCotizacion,
  useCotizacionesAceptadas,
} from "@/features/cotizacion/hooks";
import { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import { useHidratacionEditarEmbarque } from "./useHidratacionEditarEmbarque";
import { ejecutarGuardarEmbarque } from "./useEditarEmbarqueWizard.save";

/**
 * Controller hook para la página EditarEmbarque.
 * Encapsula carga del embarque, hidratación de formularios, y submit.
 */
export function useEditarEmbarqueWizard(id: string | undefined) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: embarque, isLoading, isError, refetch } = useEmbarque(id);
  const { data: conceptosVentaDb = [], isLoading: cargandoVenta } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCostoDb = [], isLoading: cargandoCosto } = useEmbarqueConceptosCosto(id);
  const { data: contenedoresDb = [], isLoading: cargandoContenedores } = useContenedoresEmbarque(id);
  const { data: clientes = [] } = useClientesForSelect();
  const { data: proveedoresDb = [] } = useProveedoresForSelect();
  // v13.303.23 — Hidratamos la cotización vinculada al embarque para que el
  // wizard de edición muestre el badge verde en lugar del banner "Cotización
  // requerida" y no obligue a re-seleccionar. Incluye estado `En operación`.
  const { data: cotizacionVinculada = null } = useCotizacion(embarque?.cotizacion_id ?? undefined);
  const { data: cotizacionesAceptadas = [] } = useCotizacionesAceptadas();
  const updateEmbarque = useUpdateEmbarque();
  const registrarActividad = useRegistrarActividad();

  const [initialized, setInitialized] = useState(false);
  const [hidratoContactos, setHidratoContactos] = useState(false);
  const [hidratoContenedores, setHidratoContenedores] = useState(false);
  const [hidratoVenta, setHidratoVenta] = useState(false);
  const [hidratoCosto, setHidratoCosto] = useState(false);
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
  }, [embarque, initialized, inicializarDesdeEmbarque]);

  useHidratacionEditarEmbarque({
    initialized,
    hidratoContactos,
    hidratoContenedores,
    hidratoVenta,
    hidratoCosto,
    setHidratoContactos,
    setHidratoContenedores,
    setHidratoVenta,
    setHidratoCosto,
    embarque,
    contactos,
    selectedClienteNombre: clientes.find((c) => c.id === clienteId)?.nombre,
    contenedoresDb,
    cargandoContenedores,
    conceptosVentaDb,
    conceptosCostoDb,
    proveedoresDb,
    inicializarVenta,
    inicializarCosto,
    methods,
  });

  const selectedCliente = clientes.find((c) => c.id === clienteId);

  const handleSave = () => ejecutarGuardarEmbarque({
    id,
    embarque,
    methods,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
    contactos,
    selectedClienteNombre: selectedCliente?.nombre,
    userEmail: user?.email,
    conceptosVenta,
    conceptosCosto,
    conceptosVentaDb,
    conceptosCostoDb,
    proveedoresDb,
    updateEmbarque,
    registrarActividad,
    setCurrentStep,
    navigate,
  });

  return {
    embarque,
    isLoading: isLoading || cargandoVenta || cargandoCosto || cargandoContenedores,
    isError,
    refetch,
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
    cotizacionVinculada,
    cotizacionesAceptadas,
  };
}
