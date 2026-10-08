import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";

/** Caché real, sin servicios ni red; dos embarques y familias no relacionadas. */
export function crearCacheSeguroFactura() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const afectadas = ["embarque-a", "embarque-b"].flatMap((id) => [
    queryKeys.embarques.pnlFinanciero(id),
    queryKeys.embarques.seguros(id),
    queryKeys.embarques.segurosFacturasElegibles(id),
  ]);
  const ajenas = [
    queryKeys.embarques.cierreValidacion("embarque-a"),
    queryKeys.embarques.detail("embarque-a"),
  ];
  for (const key of [...afectadas, ...ajenas]) {
    client.setQueryData(key, { version: "previa", prima: 100, proveedor_factura_id: "factura-a" });
  }
  return { client, afectadas, ajenas };
}
