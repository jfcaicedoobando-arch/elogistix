import { useQuery } from "@tanstack/react-query";
import { useMutationWithFeedback } from "@/hooks/shared";
import type { ContactoBroker, EmpresaBroker } from "../domain/altaProspecto";
import {
  altaProspecto, buscarEmpresa, misComisiones, misOrganizaciones, misSolicitudes, solicitarEmpresa, type PeticionEmpresa,
} from "../services/brokerPortal";

const KEY = ["broker"] as const;

export const useBrokerOrganizaciones = () =>
  useQuery({ queryKey: [...KEY, "orgs"], queryFn: misOrganizaciones });

export function useBuscarEmpresaBroker(brokerId: string | null, texto: string) {
  const q = texto.trim();
  return useQuery({
    queryKey: [...KEY, "buscar", brokerId, q],
    queryFn: () => buscarEmpresa(brokerId as string, q),
    enabled: !!brokerId && q.length >= 3,
  });
}

export const useMisSolicitudesBroker = () =>
  useQuery({ queryKey: [...KEY, "solicitudes"], queryFn: misSolicitudes, refetchInterval: 60_000 });

export const useSolicitarEmpresa = (brokerId: string | null) =>
  useMutationWithFeedback({
    mutationFn: (v: { empresaId: string } & PeticionEmpresa) => solicitarEmpresa(brokerId as string, v.empresaId, v),
    invalidate: [...KEY],
    successTitle: "Solicitud enviada",
    successDescription: "Te avisaremos cuando la autoricen o rechacen.",
    errorTitle: "No se pudo enviar la solicitud",
  });

export const useAltaProspectoBroker = (brokerId: string | null) =>
  useMutationWithFeedback({
    mutationFn: (v: { empresa: EmpresaBroker; contactos: ContactoBroker[] }) =>
      altaProspecto(brokerId as string, v.empresa, v.contactos),
    invalidate: [...KEY],
    successTitle: "Prospecto externo registrado",
    successDescription: "Se asignó un KAM por turno y ya aparece en Mis empresas.",
    errorTitle: "No se pudo registrar la empresa",
  });

export const useMisComisionesBroker = () =>
  useQuery({ queryKey: [...KEY, "comisiones"], queryFn: misComisiones, refetchInterval: 60_000 });
