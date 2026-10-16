import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { permisoPasarEmpresaAProspecto, type EmpresaProspecto } from "../domain/pasarEmpresaAProspecto";
import { fetchMembresiaProspecto, fetchVinculosProspecto } from "../services/vinculosProspectoCrm";
import { crm } from "../queryKeys";

export function usePermisoPasarAProspecto(empresa: EmpresaProspecto) {
  const auth = useAuth();
  const organization = useOrganization();
  const loading = auth.loading || organization.loading;
  const actorWriter = {
    userId: auth.user?.id ?? null, role: auth.role, orgRole: null,
    organizationId: organization.organizationId, membershipOrganizationId: auth.organizationId,
    organizationActive: false,
  };
  const writer = permisoPasarEmpresaAProspecto(actorWriter, empresa);
  const resolverMembresia = writer.estado === "oculto" && !!actorWriter.userId && !!actorWriter.organizationId && !loading;
  const membresia = useQuery({
    queryKey: crm.objetos.membresiaProspecto(actorWriter.organizationId, actorWriter.userId),
    queryFn: () => fetchMembresiaProspecto(actorWriter.userId!, actorWriter.organizationId!),
    enabled: resolverMembresia,
  });
  const actor = {
    ...actorWriter, orgRole: membresia.data?.role ?? null,
    organizationActive: membresia.data?.organizations?.activo === true,
  };
  const base = permisoPasarEmpresaAProspecto(actor, empresa);
  const comprobar = base.estado === "comprobar" && !loading;
  const query = useQuery({
    queryKey: crm.objetos.permisoProspecto(actor.organizationId, actor.userId, empresa.id, empresa.lead_origen_id),
    queryFn: () => fetchVinculosProspecto(empresa.id, empresa.lead_origen_id),
    enabled: comprobar,
  });
  if (loading) return { estado: "oculto" as const };
  if (resolverMembresia && membresia.isError) return {
    estado: "denegado" as const, motivo: "No se pudo verificar la membresía de la organización activa.",
    reintentar: () => void membresia.refetch(),
  };
  if (resolverMembresia && (membresia.isPending || membresia.isFetching)) return { estado: "oculto" as const };
  if (!comprobar) return base;
  if (query.isError) return {
    estado: "denegado" as const, motivo: "No se pudo verificar el permiso para pasar a prospecto.",
    reintentar: () => void query.refetch(),
  };
  if (query.isPending || query.isFetching) return { estado: "comprobar" as const };
  return permisoPasarEmpresaAProspecto(actor, empresa, query.data);
}
