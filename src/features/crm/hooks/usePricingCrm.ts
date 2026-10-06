import { crmPricingKeys } from "@/features/crm/queryKeys.performance";
/**
 * Hooks de la Solicitud a Pricing (CRM Fase 5). Llaves bajo ['crm','pricing'].
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { listarTarifasParaPricing } from "@/features/crm/services/pricing/tarifasParaPricing";
import {
  actualizarSolicitud, cancelarSolicitud, crearSolicitud, eliminarOpcion, enviarSolicitud,
  guardarOpcion, listarBandejaPricing, listarOpciones, listarSolicitudesOportunidad,
  listarUsuariosOrg, obtenerSolicitud, responderSolicitud,
} from "@/features/crm/services/pricing/pricingCrm";
import { mensajeErrorPricing, type SolicitudPricingInsert } from "@/features/crm/services/pricing/tiposPricing";

function useInvalidarSolicitud() {
  const qc = useQueryClient();
  return (id: string, oportunidadId: string | null | undefined) => Promise.all([
    qc.invalidateQueries({ queryKey: crmPricingKeys.solicitud(id), exact: true }),
    // Un cambio de estado mueve filas entre filtros/páginas de la bandeja.
    qc.invalidateQueries({ queryKey: crmPricingKeys.bandejas }),
    ...(oportunidadId ? [qc.invalidateQueries({ queryKey: crmPricingKeys.oportunidad(oportunidadId), exact: true })] : []),
  ]);
}
const onError = (error: unknown, variables: unknown) => notifyError(undefined, { title: "No se pudo actualizar la solicitud de Pricing",
  description: mensajeErrorPricing(error), error, method: "CRM_PRICING_MUTACION", context: { variables } });

export function useTarifasPricing(enabled: boolean) {
  return useQuery({ queryKey: crmPricingKeys.tarifas, queryFn: listarTarifasParaPricing, enabled });
}

export function useSolicitudesOportunidad(oportunidadId: string) {
  return useQuery({
    queryKey: crmPricingKeys.oportunidad(oportunidadId),
    queryFn: () => listarSolicitudesOportunidad(oportunidadId),
    // Mientras haya solicitudes enviadas sin respuesta, reconsulta solo (30 s)
    // para que el solicitante vea la respuesta de Pricing sin recargar.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((s) => s.estado === "enviada") ? 30_000 : false,
  });
}

export function useBandejaPricing(estado: string, pagina: number) {
  return useQuery({
    queryKey: crmPricingKeys.bandeja(estado, pagina),
    queryFn: () => listarBandejaPricing(estado, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useSolicitudPricing(id: string | null) {
  return useQuery({
    queryKey: crmPricingKeys.solicitud(id),
    queryFn: () => obtenerSolicitud(id as string),
    enabled: !!id,
  });
}

export function useOpcionesPricing(solicitudId: string | null) {
  return useQuery({
    queryKey: crmPricingKeys.opciones(solicitudId),
    queryFn: () => listarOpciones(solicitudId as string),
    enabled: !!solicitudId,
  });
}

export function useUsuariosOrgCrm() {
  return useQuery({ queryKey: crmPricingKeys.usuarios, queryFn: listarUsuariosOrg, staleTime: 5 * 60_000 });
}

/** Guarda (alta o edición) y, si `enviar`, la manda a Pricing en el mismo flujo. */
export function useGuardarSolicitud() {
  const invalidar = useInvalidarSolicitud();
  return useMutation({
    mutationFn: async (input: { id?: string; datos: SolicitudPricingInsert; enviar: boolean }) => {
      let id = input.id;
      if (id) await actualizarSolicitud(id, input.datos);
      else id = (await crearSolicitud(input.datos)).id;
      try {
        if (input.enviar) await enviarSolicitud(id);
        return id;
      } finally {
        // La edición/alta ya se guardó, incluso si el envío posterior falla.
        // No esperar lecturas: el callback del formulario aún debe subir adjuntos.
        void invalidar(id, input.datos.oportunidad_id);
      }
    },
    onSuccess: (_id, v) => { notifySuccess(undefined, { title: v.enviar ? "Solicitud enviada a Pricing" : "Borrador guardado" }); },
    onError: onError,
  });
}

export function useAccionSolicitud() {
  const qc = useQueryClient();
  const invalidar = useInvalidarSolicitud();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; oportunidadId: string | null; accion: "enviar" | "responder" | "cancelar" }) =>
      accion === "enviar" ? enviarSolicitud(id) : accion === "responder" ? responderSolicitud(id) : cancelarSolicitud(id),
    onSuccess: (_d, v) => {
      const t = { enviar: "Solicitud enviada", responder: "Respuesta enviada al solicitante", cancelar: "Solicitud cancelada" };
      notifySuccess(undefined, { title: t[v.accion] });
      void Promise.all([
        invalidar(v.id, v.oportunidadId),
        qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(v.id), exact: true }),
        // Traer la respuesta final antes de detener el polling al cambiar de estado.
        qc.invalidateQueries({ queryKey: crmPricingKeys.tarifasRespuesta(v.id), exact: true }),
      ]);
    },
    onError: onError,
  });
}

export function useGuardarOpcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: guardarOpcion,
    onSuccess: (_data, { solicitudId }) => {
      notifySuccess(undefined, { title: "Opción guardada" });
      void qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(solicitudId), exact: true });
    },
    onError: onError,
  });
}

export function useEliminarOpcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; solicitudId: string }) => eliminarOpcion(id),
    onSuccess: (_data, { solicitudId }) => {
      void qc.invalidateQueries({ queryKey: crmPricingKeys.opciones(solicitudId), exact: true });
    },
    onError,
  });
}
