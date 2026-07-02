/**
 * useConvertirProformaDirecto — conversión Proforma(s) → Factura borrador
 * en un solo clic, sin diálogo intermedio.
 *
 * Toma la primera serie de facturación activa de la organización y aplica
 * defaults SAT (PUE / Forma 03 / Uso G03). El contador puede editar Serie,
 * Método, Forma y Uso en el borrador antes de timbrar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/shared/useToast";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  convertirProformaAFactura,
  fetchPrimeraSerieActiva,
} from "@/features/proformas/services/convertirAFactura";

export interface ConvertirDirectoInput {
  proformaIds: string[];
  organizationId: string;
  diasCredito?: number;
}

export function useConvertirProformaDirecto() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationKey: ["fiscal", "proforma-a-factura", "directo"],
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
        metodoPago: "PUE",
        formaPago: "03",
        usoCfdi: "G03",
        diasCredito: input.diasCredito ?? 0,
        notas: null,
        requestId: crypto.randomUUID(),
      });
    },
    onSuccess: (res) => {
      toast({
        title: "Factura generada",
        description: `Borrador ${res.facturaNumero} listo. Revisa datos fiscales antes de timbrar.`,
      });
      qc.invalidateQueries({ queryKey: ["proformas"] });
      qc.invalidateQueries({ queryKey: ["proforma-detalle"] });
      qc.invalidateQueries({ queryKey: ["facturas"] });
      navigate(`/facturacion/${res.facturaId}?accion=timbrar`);
    },
    onError: (err) =>
      notifyError(undefined, { error: err, title: "Convertir proforma a factura" }),
  });

  return {
    convertir: mutation.mutate,
    isPending: mutation.isPending,
  };
}
