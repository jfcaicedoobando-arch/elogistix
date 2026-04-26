import { useEffect, useCallback, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/services/storage/index";
import { useExchangeRates } from "@/hooks/catalogos/useExchangeRates";
import { getDocsForMode } from "@/constants/embarqueConstants";
import type { DocumentoChecklist } from "@/types/documentoChecklist";
import {
  DEFAULT_EMBARQUE_VALUES,
  mapEmbarqueRowToFormValues,
  buildEmbarquePayload as buildPayload,
  buildConceptosVentaPayload as buildVentaPayload,
  buildConceptosCostoPayload as buildCostoPayload,
  buildVincularCotizacionUpdates,
  buildDesvincularCotizacionUpdates,
  type EmbarqueFormValues,
  type CotizacionParaVincular,
} from "@/lib/mappers/embarque";
import type { Tables } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
import { notifyError } from "@/lib/ui/appFeedback";

// Re-exports para compatibilidad con consumidores existentes
export type { EmbarqueFormValues } from "@/lib/mappers/embarque";
export type EmbarqueFormState = EmbarqueFormValues;
export type EmbarqueFormMethods = UseFormReturn<EmbarqueFormValues>;

type EmbarqueRow = Tables<"embarques">;
type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

export function useEmbarqueForm() {
  const methods = useForm<EmbarqueFormValues>({
    defaultValues: DEFAULT_EMBARQUE_VALUES,
    mode: "onBlur",
  });

  const { toast } = useToast();
  const [documentosArchivos, setDocumentosArchivos] = useState<Record<string, File>>({});
  const { data: tiposDeCambio } = useExchangeRates();

  // Sync tipos de cambio remotos al formulario
  useEffect(() => {
    if (tiposDeCambio) {
      methods.setValue("tipoCambioUSD", String(tiposDeCambio.usdMxn));
      methods.setValue("tipoCambioEUR", String(tiposDeCambio.eurMxn));
    }
  }, [tiposDeCambio, methods]);

  const handleMsdsUpload = async (archivo: File) => {
    methods.setValue("subiendoMsds", true);
    try {
      const { sanitizeFileName } = await import("@/lib/storage");
      const ruta = `embarques/msds/${Date.now()}_${sanitizeFileName(archivo.name)}`;
      await uploadFile(ruta, archivo);
      methods.setValue("msdsArchivo", ruta);
    } catch {
      notifyError(toast, { title: "Error al subir MSDS" });
    } finally {
      methods.setValue("subiendoMsds", false);
    }
  };

  const inicializarDesdeEmbarque = useCallback(
    (embarque: EmbarqueRow) => {
      methods.reset(mapEmbarqueRowToFormValues(embarque));
    },
    [methods],
  );

  const buildEmbarquePayload = useCallback(
    (contactos: ContactoRow[], clienteNombre: string, operador: string) =>
      buildPayload(methods.getValues(), contactos, clienteNombre, operador),
    [methods],
  );

  const buildConceptosVentaPayload = useCallback(
    (conceptosVenta: ConceptoVentaLocal[]) => buildVentaPayload(conceptosVenta),
    [],
  );

  const buildConceptosCostoPayload = useCallback(
    (
      conceptosCosto: ConceptoCostoLocal[],
      proveedoresDb: { id: string; nombre: string }[],
    ) => buildCostoPayload(conceptosCosto, proveedoresDb),
    [],
  );

  const setDocumentoArchivo = useCallback((nombre: string, file: File | undefined) => {
    setDocumentosArchivos((prev) => {
      if (!file) {
        const next = { ...prev };
        delete next[nombre];
        return next;
      }
      return { ...prev, [nombre]: file };
    });
  }, []);

  const getDocumentosChecklist = useCallback(
    (modo: string): DocumentoChecklist[] => {
      const docs = getDocsForMode(modo);
      return docs.map((nombre) => ({
        nombre,
        adjuntado: !!documentosArchivos[nombre],
        archivo: documentosArchivos[nombre]?.name,
      }));
    },
    [documentosArchivos],
  );

  const vincularCotizacion = useCallback(
    (cot: CotizacionParaVincular) => {
      const opts = { shouldValidate: true, shouldDirty: true } as const;
      for (const [field, value] of buildVincularCotizacionUpdates(cot)) {
        methods.setValue(field, value, opts);
      }
      methods.trigger();
    },
    [methods],
  );

  const desvincularCotizacion = useCallback(() => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    for (const [field, value] of buildDesvincularCotizacionUpdates()) {
      methods.setValue(field, value, opts);
    }
    methods.trigger();
  }, [methods]);

  return {
    methods,
    handleMsdsUpload,
    inicializarDesdeEmbarque,
    buildEmbarquePayload,
    buildConceptosVentaPayload,
    buildConceptosCostoPayload,
    documentosArchivos,
    setDocumentoArchivo,
    getDocumentosChecklist,
    vincularCotizacion,
    desvincularCotizacion,
  };
}
