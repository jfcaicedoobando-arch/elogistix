/**
 * Orquestador del submit de "Nuevo Embarque".
 *
 * Encapsula la cadena:
 *   resolverExpediente → subirDocumentos → createEmbarque
 *   → updateEstadoCotizacion (si hay vínculo) → registrarActividad
 *
 * Extraído de useNuevoEmbarqueWizard (v8.79) para separar la orquestación
 * de side-effects de la gestión de estado del wizard.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import {
  useCreateEmbarque,
  type ExpedienteCliente,
} from "@/hooks/useEmbarques";
import {
  useUpdateEstadoCotizacion,
  type CotizacionRow,
} from "@/hooks/useCotizaciones";
import {
  resolverExpediente,
  subirDocumentosEmbarque,
} from "@/services/embarqueServices";
import {
  resolveExpedienteForSubmit,
  buildBitacoraDetalles,
} from "@/lib/domain/embarqueWizard";
import { getErrorMessage } from "@/lib/errors";
import type { Tables } from "@/integrations/supabase/types";
import type { DocumentoChecklist } from "@/types/documentoChecklist";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import type { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;
type ProveedorRow = { id: string; nombre: string };
type ModoExpediente = "nuevo" | "existente";
type EmbarqueFormApi = ReturnType<typeof useEmbarqueForm>;

export interface SubmitOrchestratorParams {
  /** Valores actuales del formulario (RHF.getValues()). */
  values: { modo: string; tipo: string; blMaster: string };
  modoExpediente: ModoExpediente;
  expedienteSeleccionado: ExpedienteCliente | null;
  cotizacionVinculada: CotizacionRow | null;
  contactos: ContactoRow[];
  selectedClienteNombre: string;
  proveedoresDb: ProveedorRow[];
  documentosArchivos: Record<string, File>;
  // Builders inyectados desde useEmbarqueForm (tipos reales)
  buildEmbarquePayload: EmbarqueFormApi["buildEmbarquePayload"];
  buildConceptosVentaPayload: EmbarqueFormApi["buildConceptosVentaPayload"];
  buildConceptosCostoPayload: EmbarqueFormApi["buildConceptosCostoPayload"];
  getDocumentosChecklist: (modo: string) => DocumentoChecklist[];
  conceptosVenta: ConceptoVentaLocal[];
  conceptosCosto: ConceptoCostoLocal[];
}

export function useEmbarqueSubmitOrchestrator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const createEmbarque = useCreateEmbarque();
  const updateEstadoCotizacion = useUpdateEstadoCotizacion();
  const registrarActividad = useRegistrarActividad();

  const submit = useCallback(
    async (p: SubmitOrchestratorParams): Promise<boolean> => {
      try {
        const expediente = await resolveExpedienteForSubmit({
          modoExpediente: p.modoExpediente,
          expedienteSeleccionado: p.expedienteSeleccionado,
          blMaster: p.values.blMaster,
          tipo: p.values.tipo,
          resolverNuevo: resolverExpediente,
        });

        const docPayload = await subirDocumentosEmbarque(
          expediente,
          p.getDocumentosChecklist(p.values.modo),
          p.documentosArchivos,
        );

        const embarquePayload = {
          expediente,
          ...p.buildEmbarquePayload(p.contactos, p.selectedClienteNombre, user?.email || ""),
          ...(p.cotizacionVinculada ? { cotizacion_id: p.cotizacionVinculada.id } : {}),
        };

        await createEmbarque.mutateAsync({
          embarque: embarquePayload,
          conceptosVenta: p.buildConceptosVentaPayload(p.conceptosVenta),
          conceptosCosto: p.buildConceptosCostoPayload(p.conceptosCosto, p.proveedoresDb),
          documentos: docPayload,
        });

        if (p.cotizacionVinculada) {
          await updateEstadoCotizacion.mutateAsync({
            id: p.cotizacionVinculada.id,
            estado: "Embarcada",
          });
        }

        registrarActividad.mutate({
          accion: "crear",
          modulo: "embarques",
          entidad_nombre: expediente,
          detalles: buildBitacoraDetalles({
            modo: p.values.modo,
            tipo: p.values.tipo,
            clienteNombre: p.selectedClienteNombre,
            cotizacionFolio: p.cotizacionVinculada?.folio ?? null,
            modoExpediente: p.modoExpediente,
          }),
        });

        toast({
          title: "Embarque creado",
          description: `Expediente ${expediente} registrado correctamente.`,
        });
        navigate("/embarques");
        return true;
      } catch (err: unknown) {
        toast({
          title: "Error al crear embarque",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        return false;
      }
    },
    [createEmbarque, updateEstadoCotizacion, registrarActividad, toast, navigate, user?.email],
  );

  return {
    submit,
    isPending: createEmbarque.isPending,
  };
}
