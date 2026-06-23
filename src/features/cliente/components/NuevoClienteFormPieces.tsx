/**
 * Helpers presentacionales para el modal de Nuevo Cliente.
 * Aislado del Dialog para mantenerlo ≤200 líneas.
 */
import { Upload, Loader2, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { USOS_CFDI_SAT } from "@/constants/catalogosSAT";
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
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Extrayendo datos del CSF…</p>
        </div>
      ) : fileName ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium">{fileName}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
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

/** Toggle segmentado (estilo Tabs) entre captura manual y subida de CSF. */
export function ModoAltaTabs({ modo, onChange }: ModoTabsProps) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
      {(["manual", "csf"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-[5px] transition-colors",
            modo === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "manual" ? "Captura manual" : "Subir CSF (PDF)"}
        </button>
      ))}
    </div>
  );
}

/** Badge "Prellenado desde CSF" usado junto al label cuando el campo vino del PDF. */
export function PrellenadoBadge() {
  return (
    <Badge variant="secondary" className="ml-2 text-[9px] gap-0.5 px-1.5 py-0 h-4 font-medium">
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
export function ClienteField({
  label, field, form, onChange, required, className, prefilledFromCsf, validate, placeholder,
}: FieldProps) {
  const value = form[field] ?? "";
  const errorMsg = value && validate ? validate(value) : null;
  return (
    <div className={className}>
      <Label className="text-xs flex items-center">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {prefilledFromCsf && value && <PrellenadoBadge />}
      </Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        className={cn("mt-1", errorMsg && "border-destructive focus-visible:ring-destructive")}
      />
      {errorMsg && <p className="text-[11px] text-destructive mt-1">{errorMsg}</p>}
    </div>
  );
}

interface SelectsProps {
  form: ClienteForm;
  onChange: (field: keyof ClienteForm, value: string) => void;
  prefilledRegimen?: boolean;
}

/** Bloque con Régimen Fiscal + Uso CFDI default (campos SAT). */
export function ClienteFiscalSelects({ form, onChange, prefilledRegimen }: SelectsProps) {
  return (
    <>
      <div>
        <Label className="text-xs flex items-center">
          Régimen Fiscal SAT<span className="text-destructive ml-0.5">*</span>
          {prefilledRegimen && form.regimen_fiscal && <PrellenadoBadge />}
        </Label>
        <Select value={form.regimen_fiscal || undefined} onValueChange={(v) => onChange("regimen_fiscal", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
          <SelectContent>
            {REGIMENES_FISCALES_SAT.map((r) => (
              <SelectItem key={r.clave} value={r.clave}>{r.clave} — {r.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Uso CFDI por defecto</Label>
        <Select value={form.uso_cfdi_default || undefined} onValueChange={(v) => onChange("uso_cfdi_default", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona uso CFDI" /></SelectTrigger>
          <SelectContent>
            {USOS_CFDI_SAT.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/** Botón footer "Siguiente" usado para que el dialog quede más limpio. */
export function NextButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={disabled}>
      Siguiente
    </Button>
  );
}
