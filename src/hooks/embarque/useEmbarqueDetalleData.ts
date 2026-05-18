import { useEmbarqueFull } from "./useEmbarqueFullQuery";

/**
 * Hook fachada para la pantalla de detalle de embarque.
 * Centraliza los defaults `?? []` y `?? null` que de otro modo inflan la
 * complejidad ciclomática del componente.
 */
export function useEmbarqueDetalleData(id: string | undefined) {
  const { data: full, isLoading } = useEmbarqueFull(id);
  const embarque = full?.embarque ?? null;
  return {
    embarque,
    conceptosVenta: full?.conceptosVenta ?? [],
    conceptosCosto: full?.conceptosCosto ?? [],
    documentos: full?.documentos ?? [],
    notas: full?.notas ?? [],
    facturas: full?.facturas ?? [],
    tipoCambioUSD: Number(embarque?.tipo_cambio_usd) || 1,
    tipoCambioEUR: Number(embarque?.tipo_cambio_eur) || 1,
    isLoading,
  };
}
