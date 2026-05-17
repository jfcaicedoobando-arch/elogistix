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
import { useRef, useState } from "react";
import { Download, Upload, Loader2, FileWarning, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dialogSize, scrollableDialog } from "@/lib/ui/dialogTokens";
import { cn } from "@/lib/utils";
import { parseCsv, toCsv } from "@/lib/csv/parseCsv";
import type { ImportPreview, ImportRowError } from "@/lib/csv/importSchemas";

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

type Step = "upload" | "preview" | "committing" | "done";

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

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = (): void => {
    const headers = [...templateHeaders];
    const rows = templateExampleRow ? [templateExampleRow] : [];
    const csv = toCsv(headers, rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File): Promise<void> => {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) {
        setError("El archivo no contiene filas de datos.");
        return;
      }
      const result = mapRows(parsed.rows);
      setPreview(result);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(dialogSize["2xl"], scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {step === "upload" && (
          <UploadStep
            templateHeaders={templateHeaders}
            onDownloadTemplate={downloadTemplate}
            onPick={() => inputRef.current?.click()}
            error={error}
          />
        )}

        {step === "preview" && preview && (
          <PreviewStep
            fileName={fileName}
            preview={preview}
            error={error}
            onReset={reset}
          />
        )}

        {step === "committing" && (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            Importando registros...
          </div>
        )}

        {step === "done" && (
          <div className="py-10 text-center flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-base font-medium">
              {insertedCount} registro{insertedCount === 1 ? "" : "s"} importado{insertedCount === 1 ? "" : "s"} correctamente.
            </p>
          </div>
        )}

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

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Cambiar archivo
              </Button>
              <Button
                onClick={handleCommit}
                disabled={!preview || preview.valid.length === 0}
              >
                Importar {preview?.valid.length ?? 0} válidos
              </Button>
            </>
          )}
          {(step === "upload" || step === "done") && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {step === "done" ? "Cerrar" : "Cancelar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UploadStepProps {
  templateHeaders: readonly string[];
  onDownloadTemplate: () => void;
  onPick: () => void;
  error: string | null;
}

function UploadStep({ templateHeaders, onDownloadTemplate, onPick, error }: UploadStepProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">Formato esperado</p>
        <p className="text-xs text-muted-foreground">
          Encabezados aceptados (la primera fila debe ser de columnas):
        </p>
        <code className="block text-xs font-mono bg-background rounded p-2 break-all">
          {templateHeaders.join(", ")}
        </code>
        <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="mt-2">
          <Download className="h-4 w-4 mr-2" /> Descargar plantilla CSV
        </Button>
      </div>

      <Button onClick={onPick} className="w-full" size="lg">
        <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo CSV
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface PreviewStepProps<T> {
  fileName: string | null;
  preview: ImportPreview<T>;
  error: string | null;
  onReset: () => void;
}

function PreviewStep<T>({ fileName, preview, error }: PreviewStepProps<T>) {
  const { valid, invalid } = preview;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium truncate" title={fileName ?? ""}>
          {fileName ?? "Archivo"}
        </span>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-green-50 text-green-700 px-2 py-1">
            {valid.length} válidos
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-1",
              invalid.length === 0
                ? "bg-muted text-muted-foreground"
                : "bg-red-50 text-red-700",
            )}
          >
            {invalid.length} con error
          </span>
        </div>
      </div>

      {invalid.length > 0 && (
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">
              Se omitirán {invalid.length} filas con errores:
            </p>
            <ScrollArea className="max-h-40">
              <ul className="text-xs space-y-1 pr-3">
                {invalid.slice(0, 50).map((e: ImportRowError) => (
                  <li key={e.rowNumber}>
                    <span className="font-mono">Fila {e.rowNumber}:</span>{" "}
                    {e.message}
                  </li>
                ))}
                {invalid.length > 50 && (
                  <li className="text-muted-foreground">
                    ...y {invalid.length - 50} más.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {valid.length === 0 && (
        <Alert>
          <AlertDescription>
            No hay filas válidas para importar. Corrige los errores y vuelve a
            cargar el archivo.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
