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
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useClientesForSelect, useContactosCliente } from "@/features/cliente/hooks/useClientes";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import {
  useConceptosForm,
  useCotizacion,
  useCotizacionesAceptadas,
} from "@/features/cotizacion/hooks";
import { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";
import { getErrorMessage } from "@/lib/errors";
import { diffFields, diffConceptos, SENSITIVE_FIELDS } from "@/features/auditoria/utils/diffFields";
import { useHidratacionEditarEmbarque } from "./useHidratacionEditarEmbarque";
import {
  validarContenedoresMaritimo,
  buildBitacoraDetallesEdit,
} from "./useEditarEmbarqueWizard.helpers";

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

  const handleSave = async () => {
    if (!id || !embarque) return;
    try {
      const contenedoresActuales = methods.getValues('contenedores') ?? [];
      const modoActual = methods.getValues('modo');
      const errContenedores = validarContenedoresMaritimo(modoActual, contenedoresActuales);
      if (errContenedores) {
        notifyError(undefined, {
          title: "Faltan datos de contenedores",
          description: errContenedores.description,
          method: "HANDLE_SAVE",
        });
        setCurrentStep(errContenedores.step);
        return;
      }

      const nuevoEmbarquePayload = buildEmbarquePayload(contactos, selectedCliente?.nombre || '', user?.email || '');
      const nuevosVenta = buildConceptosVentaPayload(conceptosVenta);
      const nuevosCosto = buildConceptosCostoPayload(conceptosCosto, proveedoresDb);

      // Diff de campos sensibles ANTES de mutar (Bloque 3.6 ext).
      const cambiosEmbarque = diffFields(embarque, nuevoEmbarquePayload, SENSITIVE_FIELDS.embarque);
      const cambiosVenta = diffConceptos(conceptosVentaDb, nuevosVenta);
      const cambiosCosto = diffConceptos(conceptosCostoDb, nuevosCosto);

      // v13.823.64: sólo Marítimo/Multimodal sincronizan contenedores hijos. En
      // Aéreo/Terrestre el peso, volumen y piezas se capturan en el embarque; al
      // sincronizar los "contenedores" vacíos que arrastra la conversión desde
      // cotización, el recálculo automático los ponía en cero.
      const sincronizaContenedores = modoActual === "Marítimo" || modoActual === "Multimodal";

      await updateEmbarque.mutateAsync({
        id,
        embarque: nuevoEmbarquePayload,
        conceptosVenta: nuevosVenta,
        conceptosCosto: nuevosCosto,
        contenedores: sincronizaContenedores ? contenedoresActuales : undefined,
        // FIX-15 · Enviamos el `updated_at` que leímos al hidratar el wizard
        // para que la RPC rechace el guardado si alguien más ya guardó.
        expectedUpdatedAt: embarque.updated_at ?? null,
      });


      const v = methods.getValues();
      registrarActividad.mutate({
        accion: 'editar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: labelExpediente(embarque.expediente, embarque.id),
        detalles: buildBitacoraDetallesEdit({
          clienteNombre: selectedCliente?.nombre ?? '',
          modo: v.modo,
          tipo: v.tipo,
          cambiosEmbarque,
          cambiosVenta,
          cambiosCosto,
        }),
      });

      notifySuccess(undefined, { title: "Embarque actualizado", description: `${labelExpediente(embarque.expediente, embarque.id)} guardado correctamente.` });
      navigate(`/embarques/${id}`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      // FIX-15 · Conflicto de concurrencia: mensaje humano en vez del código crudo.
      if (msg.includes("LC_CONFLICTO_CONCURRENCIA")) {
        notifyError(undefined, {
          title: "Otro usuario modificó este embarque",
          description: "Recarga la página para ver los cambios más recientes y vuelve a guardar.",
          error: err,
          method: "HANDLE_SAVE",
        });
        return;
      }
      notifyError(undefined, { title: "Error al actualizar", description: msg, error: err, method: "HANDLE_SAVE" });
    }
  };

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
