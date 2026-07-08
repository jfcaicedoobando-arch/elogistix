import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchTopTarifas, type TopTarifasParams } from "@/features/costeo/services/topTarifas";

export function useTopTarifas(p: Partial<TopTarifasParams>) {
  const { organizationId } = useOrganization();
  // Normalizar fecha: "" (input date vacío) debe tratarse como no proveída,
  // no propagarse al RPC como date inválido (Postgres 22007).
  const fecha = p.fecha && p.fecha.length > 0 ? p.fecha : undefined;
  const enabled = !!(
    organizationId && p.puertoOrigenId && p.puertoDestinoId && p.tipoContenedorId
  );
  return useQuery({
    queryKey: [
      "costeo",
      "top-tarifas",
      organizationId,
      p.puertoOrigenId,
      p.puertoDestinoId,
      p.tipoContenedorId,
      fecha ?? null,
    ],
    queryFn: () =>
      fetchTopTarifas({
        puertoOrigenId: p.puertoOrigenId!,
        puertoDestinoId: p.puertoDestinoId!,
        tipoContenedorId: p.tipoContenedorId!,
        fecha,
        organizationId: organizationId!,
      }),
    enabled,
    staleTime: 60 * 1000,
  });
}
