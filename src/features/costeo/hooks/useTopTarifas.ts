import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchTopTarifas, type TopTarifasParams } from "@/features/costeo/services/topTarifas";

export function useTopTarifas(p: Partial<TopTarifasParams>) {
  const { organizationId } = useOrganization();
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
      p.fecha ?? null,
    ],
    queryFn: () =>
      fetchTopTarifas({
        puertoOrigenId: p.puertoOrigenId!,
        puertoDestinoId: p.puertoDestinoId!,
        tipoContenedorId: p.tipoContenedorId!,
        fecha: p.fecha,
        organizationId: organizationId!,
      }),
    enabled,
    staleTime: 60 * 1000,
  });
}
