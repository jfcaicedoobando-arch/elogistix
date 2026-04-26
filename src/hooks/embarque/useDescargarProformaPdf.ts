/**
 * Hook compartido para descargar el PDF de una proforma.
 * Centraliza la carga de embarque + cliente + conceptos (regulares o consolidados)
 * y la invocación del generador, eliminando duplicación entre TabFacturacion y TabProformas.
 */
import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import type { generarPdfProforma } from "@/generators/proformaPdf";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import {
  fetchClienteParaPdf,
  fetchConceptosConsolidados,
  fetchConceptosProforma,
  fetchEmbarqueParaPdf,
  type ProformaRow,
} from "@/services/proforma";

interface ProformaInput {
  id: string;
  embarque_id: string | null;
  cliente_id: string;
  es_consolidada: boolean | null;
}

interface Options {
  /** Si se provee, evita la carga del embarque (usar cuando el caller ya lo tiene). */
  embarqueOverride?: Parameters<typeof generarPdfProforma>[0]["embarque"];
}

export function useDescargarProformaPdf() {
  const tasaIva = useTasaIVA();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const descargar = useCallback(
    async (proforma: ProformaInput & ProformaRow, opts: Options = {}) => {
      setDownloadingId(proforma.id);
      try {
        const esConsolidada = !!proforma.es_consolidada;
        const embarquePromise = opts.embarqueOverride
          ? Promise.resolve(opts.embarqueOverride)
          : proforma.embarque_id
            ? fetchEmbarqueParaPdf(proforma.embarque_id)
            : Promise.resolve(null);

        const [embarque, cliente, conceptos, consolidados] = await Promise.all([
          embarquePromise,
          fetchClienteParaPdf(proforma.cliente_id),
          esConsolidada ? Promise.resolve([]) : fetchConceptosProforma(proforma.id),
          esConsolidada ? fetchConceptosConsolidados(proforma.id) : Promise.resolve([]),
        ]);

        if (!embarque) {
          toast({ title: "No se pudo cargar el embarque asociado", variant: "destructive" });
          return;
        }

        const { generarPdfProforma } = await import("@/generators/proformaPdf");
        generarPdfProforma({
          proforma,
          embarque,
          conceptos,
          cliente,
          tasaIva,
          conceptosConsolidados: consolidados,
        });
      } catch (e) {
        toast({ title: "Error al generar PDF: " + (e as Error).message, variant: "destructive" });
      } finally {
        setDownloadingId(null);
      }
    },
    [tasaIva],
  );

  return { descargar, downloadingId };
}
