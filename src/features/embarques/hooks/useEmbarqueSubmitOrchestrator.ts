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
import { useToast } from "@/hooks/shared";
import { notifyError, notifyWarning, notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared";
import {
  useCreateEmbarque,
  type ExpedienteCliente,
} from "@/features/embarques/hooks/useEmbarques";
import {
  useUpdateEstadoCotizacion,
  type CotizacionRow,
} from "@/features/cotizacion/hooks";
import {
  resolverExpediente,
  subirDocumentosEmbarque,
} from "@/features/embarques/services";
import {
  resolveExpedienteForSubmit,
  buildBitacoraDetalles,
} from "@/features/embarques/domain/embarqueWizard";
import {
  deriveContenedoresPayload,
  reportPhaseError,
} from "./useEmbarqueSubmitOrchestrator.helpers";
import { getErrorMessage } from "@/lib/errors";
import { useStableRequestId } from "@/lib/idempotency";
import type { Tables } from "@/integrations/supabase/types";
import type { DocumentoChecklist } from "@/types/documentoChecklist";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";
import type { useEmbarqueForm } from "@/features/embarques/hooks/useEmbarqueForm";

type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;
type ProveedorRow = { id: string; nombre: string };
type ModoExpediente = "nuevo" | "existente";
type EmbarqueFormApi = ReturnType<typeof useEmbarqueForm>;

export interface SubmitOrchestratorParams {
  /** Valores actuales del formulario (RHF.getValues()). */
  values: { modo: string; tipo: string; blMaster: string; tipoServicio?: string; contenedores?: ContenedorBorrador[]; pesoKg?: number | string; volumenM3?: number | string; piezas?: number | string };
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
  const reqId = useStableRequestId();

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
        return reportPhaseError(toast, "Error: generación de expediente", err);
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
        return reportPhaseError(toast, "Error: subida de documentos", err);
      }

      // Fase 3: crear embarque
      let embarqueCreadoId: string | null = null;
      try {
        const embarquePayload = {
          expediente,
          ...p.buildEmbarquePayload(p.contactos, p.selectedClienteNombre, user?.email || ""),
          ...(p.cotizacionVinculada ? { cotizacion_id: p.cotizacionVinculada.id } : {}),
        };
        const created = await createEmbarque.mutateAsync({
          embarque: embarquePayload,
          conceptosVenta: p.buildConceptosVentaPayload(p.conceptosVenta),
          conceptosCosto: p.buildConceptosCostoPayload(p.conceptosCosto, p.proveedoresDb),
          documentos: docPayload,
          contenedores: deriveContenedoresPayload(p.values),
          requestId: reqId.get(),
        });
        embarqueCreadoId = created?.id ?? null;
        reqId.reset();
      } catch (err: unknown) {
        notifyError(undefined, { phase: "guardado del embarque", message: getErrorMessage(err), error: err, method: "USE_EMBARQUE_SUBMIT_ORCHESTRATOR" });
        return false;
      }

      // Fase 4: actualizar cotización (no bloqueante) — estado + vínculo embarque_id
      if (p.cotizacionVinculada) {
        try {
          await updateEstadoCotizacion.mutateAsync({
            id: p.cotizacionVinculada.id,
            estado: "En operación",
            embarqueId: embarqueCreadoId,
          });
        } catch (err: unknown) {
          notifyWarning(undefined, {
            title: "Embarque creado con advertencia",
            description: `Cotización: no se pudo actualizar el estado (${getErrorMessage(err)}).`,
          });
        }
      }

      // Fase 5: bitácora (no bloqueante)
      registrarActividad.mutate({
        accion: "crear",
        modulo: "embarques",
        entidad_id: embarqueCreadoId ?? undefined,
        entidad_nombre: expediente,
        detalles: buildBitacoraDetalles({
          modo: p.values.modo,
          tipo: p.values.tipo,
          clienteNombre: p.selectedClienteNombre,
          cotizacionFolio: p.cotizacionVinculada?.folio ?? null,
          modoExpediente: p.modoExpediente,
        }),
      });

      notifySuccess(undefined, {
        title: "Embarque creado",
        description: `Expediente ${expediente}: registrado correctamente.`,
      });
      navigate("/embarques");
      return true;
    },
    [createEmbarque, updateEstadoCotizacion, registrarActividad, toast, navigate, user?.email, reqId],
  );

  return {
    submit,
    isPending: createEmbarque.isPending,
  };
}
