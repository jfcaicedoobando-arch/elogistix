/**
 * Hooks de la Solicitud a Pricing (CRM Fase 5). Llaves bajo ['crm','pricing'].
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  actualizarSolicitud, cancelarSolicitud, crearSolicitud, eliminarOpcion, enviarSolicitud,
  guardarOpcion, listarBandejaPricing, listarOpciones, listarSolicitudesOportunidad,
  listarUsuariosOrg, obtenerSolicitud, responderSolicitud,
} from "@/features/crm/services/pricing/pricingCrm";
import { mensajeErrorPricing, type SolicitudPricingInsert } from "@/features/crm/services/pricing/tiposPricing";

const BASE = ["crm", "pricing"] as const;

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BASE });
}
const onError = (error: unknown, variables: unknown) => notifyError(undefined, { title: "No se pudo actualizar la solicitud de Pricing",
  description: mensajeErrorPricing(error), error, method: "CRM_PRICING_MUTACION", context: { variables } });

export function useSolicitudesOportunidad(oportunidadId: string) {
  return useQuery({
    queryKey: [...BASE, "oportunidad", oportunidadId],
    queryFn: () => listarSolicitudesOportunidad(oportunidadId),
  });
}

export function useBandejaPricing(estado: string, pagina: number) {
  return useQuery({
    queryKey: [...BASE, "bandeja", estado, pagina],
    queryFn: () => listarBandejaPricing(estado, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useSolicitudPricing(id: string | null) {
  return useQuery({
    queryKey: [...BASE, "solicitud", id],
    queryFn: () => obtenerSolicitud(id as string),
    enabled: !!id,
  });
}

export function useOpcionesPricing(solicitudId: string | null) {
  return useQuery({
    queryKey: [...BASE, "opciones", solicitudId],
    queryFn: () => listarOpciones(solicitudId as string),
    enabled: !!solicitudId,
  });
}

export function useUsuariosOrgCrm() {
  return useQuery({ queryKey: [...BASE, "usuarios"], queryFn: listarUsuariosOrg, staleTime: 5 * 60_000 });
}

/** Guarda (alta o edición) y, si `enviar`, la manda a Pricing en el mismo flujo. */
export function useGuardarSolicitud() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (input: { id?: string; datos: SolicitudPricingInsert; enviar: boolean }) => {
      let id = input.id;
      if (id) await actualizarSolicitud(id, input.datos);
      else id = (await crearSolicitud(input.datos)).id;
      if (input.enviar) await enviarSolicitud(id);
      return id;
    },
    onSuccess: (_id, v) => { notifySuccess(undefined, { title: v.enviar ? "Solicitud enviada a Pricing" : "Borrador guardado" }); void invalidar(); },
    onError,
  });
}

export function useAccionSolicitud() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "enviar" | "responder" | "cancelar" }) =>
      accion === "enviar" ? enviarSolicitud(id) : accion === "responder" ? responderSolicitud(id) : cancelarSolicitud(id),
    onSuccess: (_d, v) => {
      const t = { enviar: "Solicitud enviada", responder: "Respuesta enviada al solicitante", cancelar: "Solicitud cancelada" };
      notifySuccess(undefined, { title: t[v.accion] });
      void invalidar();
    },
    onError,
  });
}

export function useGuardarOpcion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: guardarOpcion,
    onSuccess: () => { notifySuccess(undefined, { title: "Opción guardada" }); void invalidar(); },
    onError,
  });
}

export function useEliminarOpcion() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: eliminarOpcion, onSuccess: () => void invalidar(), onError });
}
