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
 */
import { Loader2, CheckCircle2 } from "lucide-react";
import { useBulkImport } from "@/components/shared/useBulkImport";
import { UploadStep, PreviewStep } from "@/components/shared/BulkImportSteps";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dialogSize, scrollableDialog } from "@/lib/ui/dialogTokens";
import { cn } from "@/lib/utils";
import { toCsv } from "@/lib/csv/parseCsv";
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

function downloadCsvTemplate(headers: readonly string[], exampleRow: string[] | undefined, fileName: string): void {
  const rows = exampleRow ? [exampleRow] : [];
  const csv = toCsv([...headers], rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  const downloadTemplate = (): void => {
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
          onDownloadTemplate={downloadTemplate}
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

interface BulkImportBodyProps<T> {
  step: "upload" | "preview" | "committing" | "done";
  preview: ImportPreview<T> | null;
  fileName: string | null;
  error: string | null;
  insertedCount: number;
  templateHeaders: readonly string[];
  onDownloadTemplate: () => void;
  onPick: () => void;
  onReset: () => void;
}

function BulkImportBody<T>({ step, preview, fileName, error, insertedCount, templateHeaders, onDownloadTemplate, onPick, onReset }: BulkImportBodyProps<T>) {
  if (step === "upload") {
    return <UploadStep templateHeaders={templateHeaders} onDownloadTemplate={onDownloadTemplate} onPick={onPick} error={error} />;
  }
  if (step === "preview" && preview) {
    return <PreviewStep fileName={fileName} preview={preview} error={error} onReset={onReset} />;
  }
  if (step === "committing") {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        Importando registros...
      </div>
    );
  }
  if (step === "done") {
    return (
      <div className="py-10 text-center flex flex-col items-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
        <p className="text-base font-medium">
          {insertedCount} registro{insertedCount === 1 ? "" : "s"} importado{insertedCount === 1 ? "" : "s"} correctamente.
        </p>
      </div>
    );
  }
  return null;
}

interface BulkImportFooterProps<T> {
  step: "upload" | "preview" | "committing" | "done";
  preview: ImportPreview<T> | null;
  onReset: () => void;
  onCommit: () => void;
  onClose: () => void;
}

function BulkImportFooter<T>({ step, preview, onReset, onCommit, onClose }: BulkImportFooterProps<T>) {
  if (step === "preview") {
    return (
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onReset}>Cambiar archivo</Button>
        <Button onClick={onCommit} disabled={!preview || preview.valid.length === 0}>
          Importar {preview?.valid.length ?? 0} válidos
        </Button>
      </DialogFooter>
    );
  }
  if (step === "upload" || step === "done") {
    return (
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose}>
          {step === "done" ? "Cerrar" : "Cancelar"}
        </Button>
      </DialogFooter>
    );
  }
  return null;
}

