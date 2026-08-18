/**
 * Cuenta de facturas de proveedor por pagar (aprobadas con saldo > 0) en la
 * org del usuario. Usado para el badge del sidebar en Compras → Por pagar.
 *
 * PERF (auditoría 2026-08-18, hallazgo #2): antes este badge tenía su propia
 * query key (`cxp.porPagarCount`) con su propio `queryFn` que llamaba de nuevo
 * a la RPC `cxp_por_pagar` — la consulta más cara de la app (650 llamadas /
 * 60.8 s acumulados, ~93 ms cada una). Al no compartir key con la bandeja
 * `/compras/por-pagar`, React Query no podía deduplicar y la RPC corría dos
 * veces por visita.
 *
 * Ahora el badge reusa EXACTAMENTE la misma key y `queryFn` que la bandeja
 * (`bandejas.cxpPorPagar`) y sólo deriva el conteo con `select`. Resultado: una
 * sola llamada a la RPC, cache compartido y las invalidaciones existentes por
 * prefijo `["bandeja"]` siguen funcionando para ambos consumidores.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCxpPorPagar } from "@/features/bandejas/services/bandejas";
import { bandejas } from "@/features/bandejas/queryKeys";
import { staleTimes } from "@/lib/query/staleTimes";

export function useCxpPorPagarCount() {
  return useQuery({
    queryKey: bandejas.cxpPorPagar,
    queryFn: fetchCxpPorPagar,
    // El badge sólo necesita el número: `select` deriva sin refetch extra.
    select: (rows) => rows.length,
    // LONG (5 min): es un badge informativo; las mutaciones de CxP ya invalidan
    // el prefijo ["bandeja"], así que no necesita revalidar cada minuto.
    staleTime: staleTimes.LONG,
  });
}
