import { useRef, useState } from "react";
import { leerArchivoTexto } from "@/lib/io/readFileText";
import { parseCsv } from "@/lib/csv/parseCsv";
import type { ImportPreview } from "@/lib/csv/importSchemas";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_FILAS,
  mensajeArchivoDemasiadoGrande,
  mensajeDemasiadasFilas,
} from "@/lib/csv/importLimits";

type Step = "upload" | "preview" | "committing" | "done";

interface UseBulkImportArgs<T> {
  mapRows: (rows: Record<string, string>[]) => ImportPreview<T>;
  onCommit: (payloads: T[]) => Promise<void>;
  onSuccess?: (insertedCount: number) => void;
}

export function useBulkImport<T>({ mapRows, onCommit, onSuccess }: UseBulkImportArgs<T>) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setStep("upload");
    setFileName(null);
    setPreview(null);
    setError(null);
    setInsertedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File): Promise<void> => {
    setError(null);
    setFileName(file.name);
    try {
      // N-05 (QA r2): tope de tamaño antes de leer el archivo completo.
      if (file.size > IMPORT_MAX_BYTES) {
        setError(mensajeArchivoDemasiadoGrande(file.size));
        return;
      }
      // N34 (Ola 4): tolera Windows-1252 (exports de Excel en es-MX).
      const text = await leerArchivoTexto(file);
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) {
        setError("El archivo no contiene filas de datos.");
        return;
      }
      if (parsed.rows.length > IMPORT_MAX_FILAS) {
        setError(mensajeDemasiadasFilas(parsed.rows.length));
        return;
      }
      setPreview(mapRows(parsed.rows));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const handleCommit = async (): Promise<void> => {
    if (!preview || preview.valid.length === 0) return;
    setStep("committing");
    setError(null);
    try {
      const payloads = preview.valid.map((v) => v.payload);
      await onCommit(payloads);
      setInsertedCount(payloads.length);
      setStep("done");
      onSuccess?.(payloads.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar.");
      setStep("preview");
    }
  };

  return {
    step, fileName, preview, error, insertedCount, inputRef,
    reset, handleFile, handleCommit,
  };
}

export type { Step };
