/**
 * Bloque 3.1 — Diálogo genérico de importación CSV.
 *
 * Flujo:
 *  1. El usuario descarga la plantilla (templateHeaders) o carga su propio CSV.
 *  2. `parseCsv` lo convierte a filas; `mapRows(rows)` valida cada renglón y
 *     devuelve `{ valid, invalid }`.
 *  3. Se muestra preview con conteos y los primeros errores.
 *  4. Al confirmar, llama `onCommit(validPayloads)` en lotes y reporta
 *     éxito/fracaso. El padre se ocupa de invalidar queries y registrar
 *     bitácora.
 *
 * El diálogo es agnóstico de la entidad: clientes y proveedores lo consumen
 * pasando su mapper y su acción de inserción.
 *
 * 13.127.0 (Ola 3): migrado a `FormDialogShell` + `FormDialogStepper` real
 * (3 pasos visibles: Cargar → Revisar → Confirmar). Cero cambios en lógica.
 */
import { Upload } from "lucide-react";
import { useBulkImport, type Step } from "@/components/shared/useBulkImport";
import { BulkImportBody, BulkImportFooter } from "@/components/shared/BulkImportDialogParts";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { downloadCsvTemplate } from "@/lib/csv/downloadCsvTemplate";
import type { ImportPreview } from "@/lib/csv/importSchemas";

export interface BulkImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  templateHeaders: readonly string[];
  templateExampleRow?: string[];
  templateFileName: string;
  mapRows: (rows: Record<string, string>[]) => ImportPreview<T>;
  /**
   * Inserta los payloads válidos. Debe lanzar si falla.
   * L3: puede llamar `reportarProgreso(n)` por lote para que el diálogo
   * indique cuántos registros quedaron guardados si algo falla a la mitad.
   */
  onCommit: (payloads: T[], reportarProgreso?: (insertados: number) => void) => Promise<void>;
  onSuccess?: (insertedCount: number) => void;
}

const STEP_LABELS = ["Cargar archivo", "Revisar", "Confirmar"];

function stepToIndex(step: Step): number {
  if (step === "upload") return 1;
  if (step === "done") return 3;
  return 2; // preview | committing
}

export function BulkImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  templateHeaders,
  templateExampleRow,
  templateFileName,
  mapRows,
  onCommit,
  onSuccess,
}: BulkImportDialogProps<T>) {
  const {
    step, fileName, preview, error, insertedCount, parcialCount, inputRef,
    reset, handleFile, handleCommit,
  } = useBulkImport<T>({ mapRows, onCommit, onSuccess });

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onDownloadTemplate = (): void => {
    downloadCsvTemplate(templateHeaders, templateExampleRow, templateFileName);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Upload}
      title={title}
      description={description}
      size="2xl"
      stepper={{ step: stepToIndex(step), totalSteps: 3, labels: STEP_LABELS }}
      footer={
        <BulkImportFooter
          step={step}
          preview={preview}
          onReset={reset}
          onCommit={handleCommit}
          onClose={() => handleOpenChange(false)}
        />
      }
    >
      <BulkImportBody
        step={step}
        preview={preview}
        fileName={fileName}
        error={error}
        insertedCount={insertedCount}
        parcialCount={parcialCount}
        templateHeaders={templateHeaders}
        onDownloadTemplate={onDownloadTemplate}
        onPick={() => inputRef.current?.click()}
        onReset={reset}
      />

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </FormDialogShell>
  );
}
