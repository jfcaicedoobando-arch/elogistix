import { useEffect, useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { uploadFile } from "@/services/storage/index";
import { useTcInicial } from "@/features/catalogos/hooks/useTcInicial";
import { getDocsForMode } from "@/features/embarques/constants/embarqueConstants";
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
} from "@/features/embarques/domain/mappers/embarque";
import { notifyError } from "@/lib/ui/appFeedback";
import type { Tables } from "@/integrations/supabase/types";
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
// Re-exports para compatibilidad con consumidores existentes
export type { EmbarqueFormValues } from "@/features/embarques/domain/mappers/embarque";

type EmbarqueRow = Tables<"embarques">;
type ContactoRow = Pick<Tables<"contactos_cliente">, "id" | "nombre" | "tipo" | "pais">;

export function useEmbarqueForm() {
  const methods = useForm<EmbarqueFormValues>({
    defaultValues: DEFAULT_EMBARQUE_VALUES,
    mode: "onBlur",
  });

  const [documentosArchivos, setDocumentosArchivos] = useState<Record<string, File>>({});
  const { data: tiposDeCambio } = useTcInicial();

  /**
   * P1-5 — En modo edición el embarque ya trae sus tipos de cambio históricos.
   * Los tipos de cambio remotos llegan de forma asíncrona y, si aterrizaban
   * después del `reset`, sobrescribían los valores guardados con los del día y
   * marcaban el formulario como sucio. Este flag congela el sync una vez que
   * el formulario se hidrató desde un embarque existente.
   */
  const hidratadoDesdeEmbarque = useRef(false);

  // Sync tipos de cambio remotos al formulario (sólo en captura nueva).
  useEffect(() => {
    if (tiposDeCambio && !hidratadoDesdeEmbarque.current) {
      const opts = { shouldValidate: true, shouldDirty: true } as const;
      methods.setValue("tipoCambioUSD", String(tiposDeCambio.usdMxn), opts);
      methods.setValue("tipoCambioEUR", String(tiposDeCambio.eurMxn), opts);
    }
  }, [tiposDeCambio, methods]);

  const handleMsdsUpload = async (archivo: File) => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    methods.setValue("subiendoMsds", true, opts);
    try {
      const { sanitizeFileName } = await import("@/lib/storage");
      const ruta = `embarques/msds/${Date.now()}_${sanitizeFileName(archivo.name)}`;
      await uploadFile(ruta, archivo);
      methods.setValue("msdsArchivo", ruta, opts);
    } catch {
      notifyError(undefined, { title: "Error al subir MSDS", method: "HANDLE_MSDS_UPLOAD", errorCode: ERROR_CODES.VALIDATION_FAILED });
    } finally {
      methods.setValue("subiendoMsds", false, opts);
    }
  };

  const inicializarDesdeEmbarque = useCallback(
    (embarque: EmbarqueRow) => {
      hidratadoDesdeEmbarque.current = true;
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

  // Snapshot del último vincular: permite que desvincular("limpiar") respete
  // los campos que el usuario tocó manualmente después de heredarlos (Pack B).
  const vincularSnapshotRef = useRef<
    import("@/features/embarques/domain/mappers/embarque").VincularSnapshot
  >({});

  const vincularCotizacion = useCallback(
    (cot: CotizacionParaVincular) => {
      const opts = { shouldValidate: true, shouldDirty: true } as const;
      const updates = buildVincularCotizacionUpdates(cot);
      for (const [field, value] of updates) {
        methods.setValue(field, value as never, opts);
      }
      vincularSnapshotRef.current = Object.fromEntries(updates);
      methods.trigger();
    },
    [methods],
  );

  const desvincularCotizacion = useCallback(
    (modo: "limpiar" | "conservar" | "solo-conceptos" = "limpiar") => {
      const opts = { shouldValidate: true, shouldDirty: true } as const;
      const updates = buildDesvincularCotizacionUpdates(
        modo,
        vincularSnapshotRef.current,
        methods.getValues(),
      );
      for (const [field, value] of updates) {
        methods.setValue(field, value as never, opts);
      }
      if (modo === "limpiar") vincularSnapshotRef.current = {};
      methods.trigger();
    },
    [methods],
  );

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
