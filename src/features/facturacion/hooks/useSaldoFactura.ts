/**
 * A1 — Notas de crédito APLICADAS de una factura: fuente única para el saldo
 * en la UI interna (detalle de factura y diálogo de registrar pago).
 *
 * Mismo filtro que los services de cobranza/estado de cuenta:
 * estado "Aplicada" y sin `deleted_at`.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listarNotasCreditoPorFactura } from "@/features/facturacion/services/notasCredito";

export function useNotasCreditoAplicadas(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.notasCredito(facturaId ?? ""),
    queryFn: async () => {
      const notas = await listarNotasCreditoPorFactura(facturaId as string);
      return notas.filter((n) => !n.deleted_at && n.estado === "Aplicada");
    },
    enabled: !!facturaId,
    staleTime: 60_000,
  });
}
