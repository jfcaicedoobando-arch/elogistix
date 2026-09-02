/**
 * Sub-componentes presentacionales de `BulkImportDialog`.
 * Extraídos en 11.60.0 (Bloque B3) para mantener el dialog ≤200 líneas.
 */
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadStep, PreviewStep } from "@/components/shared/BulkImportSteps";
import type { ImportPreview } from "@/lib/csv/importSchemas";

export type BulkImportStep = "upload" | "preview" | "committing" | "done";

interface BodyProps<T> {
  step: BulkImportStep;
  preview: ImportPreview<T> | null;
  fileName: string | null;
  error: string | null;
  insertedCount: number;
  /** L3: registros ya guardados cuando la carga se interrumpió a la mitad. */
  parcialCount?: number;
  /** Defecto 4: filas omitidas por ya existir o repetirse en el archivo. */
  omitidosCount?: number;
  templateHeaders: readonly string[];
  onDownloadTemplate: () => void;
  onPick: () => void;
  onReset: () => void;
}

export function BulkImportBody<T>({
  step, preview, fileName, error, insertedCount, parcialCount = 0, omitidosCount = 0,
  templateHeaders, onDownloadTemplate, onPick, onReset,
}: BodyProps<T>) {
  if (step === "upload") {
    return (
      <UploadStep
        templateHeaders={templateHeaders}
        onDownloadTemplate={onDownloadTemplate}
        onPick={onPick}
        error={error}
      />
    );
  }
  if (step === "preview" && preview) {
    return (
      <PreviewStep
        fileName={fileName}
        preview={preview}
        error={error}
        parcialCount={parcialCount}
        onReset={onReset}
      />
    );
  }
  if (step === "committing") {
    return (
      <div className="py-12 text-center text-body text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        Importando registros...
      </div>
    );
  }
  if (step === "done") {
    return (
      <div className="py-10 text-center flex flex-col items-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="text-base font-medium">
          {insertedCount} registro{insertedCount === 1 ? "" : "s"} importado{insertedCount === 1 ? "" : "s"} correctamente.
        </p>
        {omitidosCount > 0 && (
          <p className="text-body-sm text-muted-foreground max-w-md">
            Se omitieron {omitidosCount} fila{omitidosCount === 1 ? "" : "s"} porque
            ya existían o estaban repetidas en el archivo.
          </p>
        )}
      </div>
    );
  }
  return null;
}

interface FooterProps<T> {
  step: BulkImportStep;
  preview: ImportPreview<T> | null;
  onReset: () => void;
  onCommit: () => void;
  onClose: () => void;
}

export function BulkImportFooter<T>({
  step, preview, onReset, onCommit, onClose,
}: FooterProps<T>) {
  if (step === "preview") {
    return (
      <>
        <Button variant="outline" onClick={onReset}>Cambiar archivo</Button>
        <Button onClick={onCommit} disabled={!preview || preview.valid.length === 0}>
          Importar {preview?.valid.length ?? 0} válidos
        </Button>
      </>
    );
  }
  if (step === "upload" || step === "done") {
    return (
      <Button variant="outline" onClick={onClose}>
        {step === "done" ? "Cerrar" : "Cancelar"}
      </Button>
    );
  }
  return null;
}
