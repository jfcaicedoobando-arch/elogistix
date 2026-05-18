import { useEmbarqueFull, type EmbarqueFullData } from "./useEmbarqueFullQuery";

function tc(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function pick<K extends keyof EmbarqueFullData>(
  full: EmbarqueFullData | null | undefined,
  key: K,
): NonNullable<EmbarqueFullData[K]> {
  return (full?.[key] ?? ([] as unknown)) as NonNullable<EmbarqueFullData[K]>;
}

/**
 * Hook fachada para la pantalla de detalle de embarque.
 * Centraliza los defaults `?? []` y los tipos de cambio para mantener
 * baja la complejidad ciclomática del componente consumidor.
 */
export function useEmbarqueDetalleData(id: string | undefined) {
  const { data: full, isLoading } = useEmbarqueFull(id);
  const embarque = full?.embarque ?? null;
  return {
    embarque,
    conceptosVenta: pick(full, "conceptosVenta"),
    conceptosCosto: pick(full, "conceptosCosto"),
    documentos: pick(full, "documentos"),
    notas: pick(full, "notas"),
    facturas: pick(full, "facturas"),
    tipoCambioUSD: tc(embarque?.tipo_cambio_usd),
    tipoCambioEUR: tc(embarque?.tipo_cambio_eur),
    isLoading,
  };
}
