import { Download, Upload, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ImportPreview, ImportRowError } from "@/lib/csv/importSchemas";

interface UploadStepProps {
  templateHeaders: readonly string[];
  onDownloadTemplate: () => void;
  onPick: () => void;
  error: string | null;
}

export function UploadStep({ templateHeaders, onDownloadTemplate, onPick, error }: UploadStepProps) {
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

export function PreviewStep<T>({ fileName, preview, error }: PreviewStepProps<T>) {
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
            <div className="max-h-40 overflow-y-auto">
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
            </div>
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
