import { Upload, FileText } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

export function fieldErrorProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(error && "border-destructive"),
  };
}

export function numberInputProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(
      error && "border-destructive",
      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    ),
  };
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}

interface MsdsProps {
  onMsdsUpload: (file: File) => void;
}

export function MsdsUploadSection({ onMsdsUpload }: MsdsProps) {
  const { watch } = useFormContext<EmbarqueFormValues>();
  const msdsArchivo = watch("msdsArchivo");
  const subiendoMsds = watch("subiendoMsds");
  const msdsNombreArchivo = msdsArchivo ? msdsArchivo.split("/").pop() : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) onMsdsUpload(archivo);
    e.target.value = "";
  }

  function openPicker() {
    document.getElementById("msds-file-input")?.click();
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="msds-file-input">Hoja de Seguridad (MSDS)</Label>
      {msdsNombreArchivo ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden />
          <span className="truncate">{msdsNombreArchivo}</span>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Cambiar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" disabled={subiendoMsds} onClick={openPicker}>
          <Upload className="h-4 w-4 mr-2" aria-hidden />
          {subiendoMsds ? "Subiendo..." : "Adjuntar MSDS"}
        </Button>
      )}
      <input
        id="msds-file-input"
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
