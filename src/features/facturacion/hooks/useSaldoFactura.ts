/**
 * A1 — Notas de crédito APLICADAS de una factura: fuente única para el saldo
 * en la UI interna (detalle de factura y diálogo de registrar pago).
 *
 * Mismo filtro que los services de cobranza/estado de cuenta:
 * estado "Aplicada" y sin `deleted_at`.
 *
 * N9 (v13.823.390) — El IMPORTE del saldo ya no se calcula sumando `nc.monto`
 * en crudo: `useSaldoFacturaServidor` trae el saldo canónico de la BD (notas de
 * crédito ya convertidas a la moneda de la factura). La lista de notas se
 * conserva porque la UI muestra los documentos.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listarNotasCreditoPorFactura } from "@/features/facturacion/services/notasCredito";
import { fetchSaldoFacturaServidor } from "@/features/facturacion/services/saldoFacturaServidor";
import { esNcClienteVigente } from "@/lib/domain/estadosFactura";

export function useNotasCreditoAplicadas(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.notasCredito(facturaId ?? ""),
    queryFn: () => listarNotasCreditoPorFactura(facturaId as string),
    // La caché conserva TODOS los documentos; el filtro pertenece sólo a este
    // observador. La lista de detalle usa la misma clave e incluye borradores.
    select: (notas) => notas.filter((n) => !n.deleted_at && esNcClienteVigente(n.estado)),
    enabled: !!facturaId,
    staleTime: 60_000,
  });
}

/** Saldo canónico servidor (`public.saldo_factura`). */
export function useSaldoFacturaServidor(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.saldoServidor(facturaId ?? ""),
    queryFn: () => fetchSaldoFacturaServidor(facturaId as string),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}
