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
 * 11.60.0 (Bloque B3): `BulkImportBody`/`Footer` y `downloadCsvTemplate`
 * extraídos a archivos hermanos para mantener este componente ≤200 líneas.
 */
import { useBulkImport } from "@/components/shared/useBulkImport";
import { BulkImportBody, BulkImportFooter } from "@/components/shared/BulkImportDialogParts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { cn } from "@/lib/utils";
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
  /** Inserta los payloads válidos. Debe lanzar si falla. */
  onCommit: (payloads: T[]) => Promise<void>;
  onSuccess?: (insertedCount: number) => void;
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
    step, fileName, preview, error, insertedCount, inputRef,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(dialogSize["2xl"], scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <BulkImportBody
          step={step}
          preview={preview}
          fileName={fileName}
          error={error}
          insertedCount={insertedCount}
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

        <BulkImportFooter
          step={step}
          preview={preview}
          onReset={reset}
          onCommit={handleCommit}
          onClose={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
