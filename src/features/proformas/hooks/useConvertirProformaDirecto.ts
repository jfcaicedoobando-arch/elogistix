/**
 * useConvertirProformaDirecto — conversión Proforma(s) → Factura borrador
 * en un solo clic, sin diálogo intermedio.
 *
 * Toma la primera serie de facturación activa de la organización y aplica
 * defaults SAT (PUE / Forma 03 / Uso G03). El contador puede editar Serie,
 * Método, Forma y Uso en el borrador antes de timbrar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  convertirProformaAFactura,
  fetchPrimeraSerieActiva,
} from "@/features/proformas/services/convertirAFactura";
import { queryKeys } from "@/lib/query";

export interface ConvertirDirectoInput {
  proformaIds: string[];
  organizationId: string;
  /**
   * Plazo de crédito explícito. `null`/`undefined` deja que la RPC aplique la
   * cascada proforma → ficha del cliente → 0 (v13.331.9).
   */
  diasCredito?: number | null;
}

export function useConvertirProformaDirecto() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationKey: queryKeys.proformas.convertirDirecto,
    mutationFn: async (input: ConvertirDirectoInput) => {
      if (!input.proformaIds.length) {
        throw new Error("Selecciona al menos una proforma");
      }
      const serie = await fetchPrimeraSerieActiva(input.organizationId);
      if (!serie) {
        throw new Error(
          "Esta organización no tiene series de facturación activas. Crea una en Configuración → Facturación antes de continuar.",
        );
      }
      return convertirProformaAFactura({
        proformaIds: input.proformaIds,
        serieId: serie.id,
        metodoPago: "PPD",
        formaPago: "99",
        usoCfdi: "G03",
        diasCredito: input.diasCredito ?? null,
        notas: null,
        requestId: crypto.randomUUID(),
      });
    },
    onSuccess: (res) => {
      const monedas = res.map((r) => r.moneda).join(" y ");
      if (res.length > 1) {
        toast({
          title: `Se generaron ${res.length} borradores`,
          description: `Uno por cada moneda (${monedas}). El SAT no permite CFDI multi-moneda; revisa y timbra cada borrador en Facturación.`,
        });
      } else {
        const r = res[0];
        toast({
          title: "Borrador de factura generado",
          description: `Borrador ${r.facturaNumero.startsWith("BORRADOR-") ? "sin folio" : r.facturaNumero} (${r.moneda}) listo. El folio interno se asignará al timbrar.`,
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
    },
    onError: (err) =>
      notifyError(undefined, { error: err, title: "Convertir proforma a factura" }),
  });

  return {
    convertir: mutation.mutate,
    isPending: mutation.isPending,
  };
}
