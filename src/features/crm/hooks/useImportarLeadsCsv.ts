/**
 * Hook que orquesta el flujo de importación CSV de leads.
 * Extraído de `ImportarLeadsCsvDialog` en 11.60.0 (Bloque B2).
 */
import { useState, useMemo, useCallback } from "react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { useCrearLeadsBulk } from "@/features/crm/hooks";
import {
  parseLeadsCsv,
  mapLeadCsvRows,
  type ParsedLeadRow,
} from "@/lib/csv/leadsCsv";

export interface UseImportarLeadsCsvOptions {
  onDone: () => void;
}

export function useImportarLeadsCsv({ onDone }: UseImportarLeadsCsvOptions) {
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [fileName, setFileName] = useState("");
  const crearBulk = useCrearLeadsBulk();

  const reset = useCallback(() => {
    setRows([]);
    setFileName("");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setRows(mapLeadCsvRows(parseLeadsCsv(text)));
  }, []);

  const validRows = useMemo(() => rows.filter((r) => !r.__error), [rows]);
  const errorCount = rows.length - validRows.length;

  const handleImport = useCallback(async () => {
    try {
      const { inserted } = await crearBulk.mutateAsync(validRows);
      notifySuccess(undefined, {
        title: `${inserted} leads importados`,
        description: errorCount > 0 ? `${errorCount} filas omitidas por errores` : undefined,
      });
      reset();
      onDone();
    } catch (e) {
      notifyError(undefined, {
        title: "Error al importar",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "USE_IMPORTAR_LEADS_CSV",
      });
    }
  }, [crearBulk, validRows, errorCount, reset, onDone]);

  return {
    rows,
    fileName,
    validRows,
    errorCount,
    isPending: crearBulk.isPending,
    reset,
    handleFile,
    handleImport,
  };
}
