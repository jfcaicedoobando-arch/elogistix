/**
 * Helpers presentacionales para el modal de Nuevo Cliente.
 * Aislado del Dialog para mantenerlo ≤200 líneas.
 */
import { useState } from "react";
import { Upload, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

import type { ClienteForm } from "@/features/cliente/hooks";



interface CsfDropZoneProps {
  parsingCsf: boolean;
  fileName?: string | null;
  onFile: (file: File | null) => void;
}

/** Drop-zone real (no sólo botón) para subir la CSF en PDF. */
export function CsfDropZone({ parsingCsf, fileName, onFile }: CsfDropZoneProps) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        "block rounded-lg border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors",
        fileName
          ? "border-primary/40 bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
      )}
    >
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {parsingCsf ? (
        <SkeletonGroup loadingLabel="Extrayendo datos del CSF" className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </SkeletonGroup>
      ) : fileName ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium">{fileName}</span>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span>Arrastra la <strong>Constancia de Situación Fiscal (PDF)</strong> o haz clic para seleccionar</span>
          <span className="text-xs">Pre-llenará Nombre, RFC, CP, dirección y régimen</span>
        </div>
      )}
    </label>
  );
}

interface ModoTabsProps {
  modo: "manual" | "csf";
  onChange: (modo: "manual" | "csf") => void;
}

/** Toggle segmentado entre captura manual y subida de CSF (ToggleGroup del UI kit). */
export function ModoAltaTabs({ modo, onChange }: ModoTabsProps) {
  return (
    <ToggleGroup
      type="single"
      value={modo}
      onValueChange={(v) => {
        if (v === "manual" || v === "csf") onChange(v);
      }}
      className="bg-muted/40"
    >
      <ToggleGroupItem
        value="manual"
        aria-label="Captura manual"
        className="text-xs data-[state=on]:bg-background data-[state=on]:text-foreground"
      >
        Captura manual
      </ToggleGroupItem>
      <ToggleGroupItem
        value="csf"
        aria-label="Subir CSF (PDF)"
        className="text-xs data-[state=on]:bg-background data-[state=on]:text-foreground"
      >
        Subir CSF (PDF)
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Badge "Prellenado desde CSF" usado junto al label cuando el campo vino del PDF. */
export function PrellenadoBadge() {
  return (
    <Badge variant="secondary" className="ml-2 text-3xs gap-0.5 px-1.5 py-0 h-4 font-medium">
      <Sparkles className="h-2.5 w-2.5" /> CSF
    </Badge>
  );
}

interface FieldProps {
  label: string;
  field: keyof ClienteForm;
  form: ClienteForm;
  onChange: (field: keyof ClienteForm, value: string) => void;
  required?: boolean;
  className?: string;
  prefilledFromCsf?: boolean;
  validate?: (value: string) => string | null;
  placeholder?: string;
}

/** Input genérico con label, marca de requerido, badge de CSF y mensaje inline. */
/** Mensaje de error del campo: obligatorio vacío (tras salir) o formato inválido. */
function mensajeErrorCampo(
  value: string,
  tocado: boolean,
  required?: boolean,
  validate?: (v: string) => string | null,
): string | null {
  if (required && tocado && !value.trim()) return "Este dato es obligatorio.";
  if (!validate || !value) return null;
  return validate(value);
}

export function ClienteField({
  label, field, form, onChange, required, className, prefilledFromCsf, validate, placeholder,
}: FieldProps) {
  const value = form[field] ?? "";
  // v13.823.77 — el mensaje aparece cuando el usuario ya salió del campo (o si
  // hay algo escrito): antes "Correo inválido." se pintaba a media captura.
  const [tocado, setTocado] = useState(false);
  const errorMsg = mensajeErrorCampo(value, tocado, required, validate);
  const inputId = `nuevo-cliente-${String(field)}`;
  const errorId = `${inputId}-error`;
  return (
    <div className={className}>
      <Label size="sm" className="flex items-center" htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {prefilledFromCsf && value && <PrellenadoBadge />}
      </Label>
      <Input
        id={inputId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        onBlur={() => setTocado(true)}
        aria-invalid={errorMsg ? true : undefined}
        aria-describedby={errorMsg ? errorId : undefined}
        className={cn("mt-1", errorMsg && "border-destructive focus-visible:ring-destructive")}
      />
      {errorMsg && <p id={errorId} className="text-label text-destructive mt-1">{errorMsg}</p>}
    </div>
  );
}


export { ClienteFiscalSelects } from "./ClienteFiscalSelects";
