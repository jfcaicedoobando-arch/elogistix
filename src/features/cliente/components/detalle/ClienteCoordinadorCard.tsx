import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { CoordinadorSelect } from "@/components/shared/CoordinadorSelect";
import { puedeAsignarCoordinador } from "@/lib/access/coordinadorAsignacion";
import { asignarCoordinadorCliente, fetchCoordinadorCliente } from "@/lib/operaciones/coordinador";
import { queryKeys } from "@/lib/query";

/** Coordinador fijo del cliente: lo usan los handovers de clientes generales. */
export function ClienteCoordinadorCard({ clienteId, tipoCliente }: { clienteId: string; tipoCliente: string }) {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const query = useQuery({
    queryKey: queryKeys.clientes.coordinador(organizationId, clienteId),
    enabled: Boolean(organizationId),
    queryFn: () => (organizationId ? fetchCoordinadorCliente(clienteId, organizationId) : Promise.resolve(null)),
  });
  if (tipoCliente === "especial") {
    return (
      <p className="text-body-sm text-muted-foreground border rounded-md p-3">
        Cliente especial: cada operación la atiende quien crea la cotización.
      </p>
    );
  }
  if (query.isLoading || query.isError) return null;
  return (
    <dl className="border rounded-md p-3 max-w-sm text-body">
      <CoordinadorSelect
        label="Coordinador logístico del cliente"
        value={query.data ?? null}
        editable={puedeAsignarCoordinador(effectiveRole)}
        permitirVacio
        onGuardar={(id) => asignarCoordinadorCliente(clienteId, id)}
        onGuardado={() => void query.refetch()}
      />
    </dl>
  );
}
