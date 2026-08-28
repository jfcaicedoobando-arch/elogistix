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
  /**
   * L3 (Ola E2 · B): recibe `reportarProgreso` para informar cuántas filas
   * quedaron guardadas. Si un lote falla a la mitad, el usuario ve el corte
   * exacto en vez de un "error" opaco que lo hace re-subir todo el archivo.
   */
  onCommit: (payloads: T[], reportarProgreso?: (insertados: number) => void) => Promise<void>;
  onSuccess?: (insertedCount: number) => void;
}

export function useBulkImport<T>({ mapRows, onCommit, onSuccess }: UseBulkImportArgs<T>) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);
  const [parcialCount, setParcialCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setStep("upload");
    setFileName(null);
    setPreview(null);
    setError(null);
    setInsertedCount(0);
    setParcialCount(0);
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
    setParcialCount(0);
    let guardados = 0;
    try {
      const payloads = preview.valid.map((v) => v.payload);
      await onCommit(payloads, (n) => {
        guardados = n;
        setParcialCount(n);
      });
      setInsertedCount(payloads.length);
      setStep("done");
      onSuccess?.(payloads.length);
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "Error al importar.";
      // L3: además del corte parcial, decimos EXACTAMENTE en qué fila del CSV
      // se atoró. Analogía: no basta decir "se imprimieron 40 hojas", hay que
      // decir "se atoró en la hoja 41" para volver a meter sólo esas.
      const pendientes = preview.valid.slice(guardados);
      const primeraFallida = pendientes[0]?.rowNumber;
      const ultimaFallida = pendientes[pendientes.length - 1]?.rowNumber;
      const rango =
        primeraFallida === undefined
          ? ""
          : primeraFallida === ultimaFallida
            ? ` Falta la fila ${primeraFallida} del archivo.`
            : ` Faltan las filas ${primeraFallida} a ${ultimaFallida} del archivo.`;
      setError(
        guardados > 0
          ? `${detalle} Se guardaron ${guardados} de ${preview.valid.length} registros.${rango}`
          : `${detalle}${rango}`,
      );
      setParcialCount(guardados);
      if (guardados > 0) onSuccess?.(guardados);
      setStep("preview");
    }

  };

  return {
    step, fileName, preview, error, insertedCount, parcialCount, inputRef,
    reset, handleFile, handleCommit,
  };

}

export type { Step };
