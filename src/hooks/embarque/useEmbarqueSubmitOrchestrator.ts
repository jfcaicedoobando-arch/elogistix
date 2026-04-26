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
import { notifyError, notifyWarning, notifySuccess } from "@/lib/ui/appFeedback";
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
} from "@/services/embarque";
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
      // Fase 1: resolver expediente
      let expediente: string;
      try {
        expediente = await resolveExpedienteForSubmit({
          modoExpediente: p.modoExpediente,
          expedienteSeleccionado: p.expedienteSeleccionado,
          blMaster: p.values.blMaster,
          tipo: p.values.tipo,
          resolverNuevo: resolverExpediente,
        });
      } catch (err: unknown) {
        toast({
          title: "Error: generación de expediente",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        return false;
      }

      // Fase 2: subir documentos
      let docPayload;
      try {
        docPayload = await subirDocumentosEmbarque(
          expediente,
          p.getDocumentosChecklist(p.values.modo),
          p.documentosArchivos,
        );
      } catch (err: unknown) {
        toast({
          title: "Error: subida de documentos",
          description: getErrorMessage(err),
          variant: "destructive",
        });
        return false;
      }

      // Fase 3: crear embarque
      try {
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
      } catch (err: unknown) {
        notifyError(toast, { phase: "guardado del embarque", message: getErrorMessage(err) });
        return false;
      }

      // Fase 4: actualizar cotización (no bloqueante)
      if (p.cotizacionVinculada) {
        try {
          await updateEstadoCotizacion.mutateAsync({
            id: p.cotizacionVinculada.id,
            estado: "Embarcada",
          });
        } catch (err: unknown) {
          notifyWarning(toast, {
            title: "Embarque creado con advertencia",
            description: `Cotización: no se pudo actualizar el estado (${getErrorMessage(err)}).`,
          });
        }
      }

      // Fase 5: bitácora (no bloqueante)
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

      notifySuccess(toast, {
        title: "Embarque creado",
        description: `Expediente ${expediente}: registrado correctamente.`,
      });
      navigate("/embarques");
      return true;
    },
    [createEmbarque, updateEstadoCotizacion, registrarActividad, toast, navigate, user?.email],
  );

  return {
    submit,
    isPending: createEmbarque.isPending,
  };
}
