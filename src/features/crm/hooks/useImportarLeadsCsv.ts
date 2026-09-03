/**
 * Hook que orquesta el flujo de importación CSV de leads.
 * Extraído de `ImportarLeadsCsvDialog` en 11.60.0 (Bloque B2).
 * v13.630.0 (Ola A): higiene — omite duplicados exactos y avisa de posibles.
 *
 * Falla cerrada: mientras la revisión de duplicados está en vuelo (o si falló)
 * NO se puede importar; el usuario puede reintentar la revisión.
 */
import { useState, useMemo, useCallback } from "react";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { useCrearLeadsBulk } from "@/features/crm/hooks";
import { useDuplicadosLote } from "@/features/crm/hooks/useLeadsDuplicados";
import {
  parseLeadsCsv,
  mapLeadCsvRows,
  type ParsedLeadRow,
} from "@/lib/csv/leadsCsv";
import { leerArchivoTexto } from "@/lib/io/readFileText";

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
    // Limpiar primero: si la lectura/parseo falla, no debe quedar el preview
    // del archivo anterior habilitando una importación equivocada.
    setRows([]);
    setFileName(file.name);
    try {
      // Ola 5 · N34: file.text() decodifica siempre UTF-8 → mojibake con CSV
      // Windows-1252 de Excel en es-MX (acentos/ñ corruptos en empresas y
      // contactos). El helper intenta UTF-8 fatal y cae a windows-1252.
      const text = await leerArchivoTexto(file);
      setRows(mapLeadCsvRows(parseLeadsCsv(text)));
    } catch (e) {
      setRows([]);
      setFileName("");
      notifyError(undefined, {
        title: "No se pudo leer el archivo",
        description: e instanceof Error ? e.message : undefined,
        error: e,
        method: "USE_IMPORTAR_LEADS_CSV_FILE",
      });
    }
  }, []);

  const dup = useDuplicadosLote(rows);
  const { coincidencias, isFetching: duplicadosCargando, isError: duplicadosError } = dup;
  const duplicadosListo = rows.length === 0 || dup.listo;

  const validRows = useMemo(
    () =>
      rows.filter(
        (r, i) => !r.__error && coincidencias[i]?.nivel !== "exacto",
      ),
    [rows, coincidencias],
  );
  const errorCount = rows.filter((r) => Boolean(r.__error)).length;
  const duplicadosCount = coincidencias.filter((c) => c.nivel === "exacto").length;
  const puedeImportar =
    rows.length > 0 &&
    validRows.length > 0 &&
    duplicadosListo &&
    !duplicadosCargando &&
    !duplicadosError &&
    !crearBulk.isPending;

  const reintentarDuplicados = useCallback(() => {
    void dup.refetch();
  }, [dup]);

  const handleImport = useCallback(async () => {
    // Guard interno: el `disabled` visual no basta (hotkeys, doble clic).
    if (!puedeImportar) return;
    try {
      const { affected, aviso } = await crearBulk.mutateAsync(validRows);
      const omitidas: string[] = [];
      if (errorCount > 0) omitidas.push(`${errorCount} con errores`);
      if (duplicadosCount > 0) omitidas.push(`${duplicadosCount} duplicadas`);
      const partes = [
        omitidas.length > 0 ? `Omitidas: ${omitidas.join(" y ")}` : null,
        aviso ?? null,
      ].filter(Boolean);
      notifySuccess(undefined, {
        title: `${affected} leads importados`,
        description: partes.length > 0 ? partes.join(" · ") : undefined,
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
  }, [puedeImportar, crearBulk, validRows, errorCount, duplicadosCount, reset, onDone]);

  return {
    rows,
    fileName,
    validRows,
    errorCount,
    duplicados: coincidencias,
    duplicadosCargando,
    duplicadosError,
    duplicadosCount,
    puedeImportar,
    reintentarDuplicados,
    isPending: crearBulk.isPending,
    reset,
    handleFile,
    handleImport,
  };
}
