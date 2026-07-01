/**
 * Hook para obtener resumen legible (naviera/ruta/contenedor/vigencia) de
 * una lista de tarifas por ID. Utilizado por "Origen de costos" en el detalle
 * de embarques para evitar mostrar UUIDs crudos.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchTarifasResumen, type TarifaResumen } from "@/features/costeo/services/tarifas";

export function useTarifasResumen(ids: Array<string | null | undefined>) {
  const clean = Array.from(
    new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0)),
  ).sort();
  return useQuery<Record<string, TarifaResumen>>({
    queryKey: ["tarifas", "resumen", clean],
    queryFn: () => fetchTarifasResumen(clean),
    enabled: clean.length > 0,
    staleTime: 5 * 60_000,
  });
}
