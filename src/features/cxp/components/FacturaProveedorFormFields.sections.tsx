/**
 * Sub-secciones de FacturaProveedorFormFields, extraídas para mantener el
 * archivo principal ≤ 200 líneas (Power of 10 #4).
 */
import { useState } from "react";
import { Building2, FileText, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProveedorCombobox } from "./ProveedorCombobox";
import {
  FormSection, FieldError, RequiredMark,
  type FacturaFormValues,
} from "./facturaFormPrimitives";

interface ProveedorYFolioProps {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  onProveedor: (id: string, nombre: string, diasCredito?: number) => void;
  errors: Partial<Record<keyof FacturaFormValues, string>>;
  proveedorReadOnly: boolean;
  proveedorNombre?: string;
}

export function ProveedorYFolioSection({
  values, onChange, onProveedor, errors, proveedorReadOnly, proveedorNombre,
}: ProveedorYFolioProps) {
  return (
    <FormSection
      title={proveedorReadOnly ? "Folio del proveedor" : "Proveedor y folio"}
      icon={<Building2 className="h-3.5 w-3.5" />}
    >
      {proveedorReadOnly ? (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proveedor (no editable)
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground truncate">
              {proveedorNombre ?? "—"}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Folio del proveedor<RequiredMark /></Label>
            <Input value={values.folio} onChange={(e) => onChange("folio", e.target.value)} placeholder="A-12345" />
            <FieldError msg={errors.folio} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Proveedor<RequiredMark /></Label>
            <ProveedorCombobox value={values.provId} onChange={onProveedor} className="w-full" />
            <FieldError msg={errors.provId} />
          </div>
          <div className="space-y-1">
            <Label>Folio del proveedor<RequiredMark /></Label>
            <Input value={values.folio} onChange={(e) => onChange("folio", e.target.value)} placeholder="A-12345" />
            <FieldError msg={errors.folio} />
          </div>
        </div>
      )}
    </FormSection>
  );
}

interface NotasProps {
  value: string;
  onChange: (v: string) => void;
}

export function NotasSection({ value, onChange }: NotasProps) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-overline font-semibold hover:text-foreground transition-colors">
        <FileText className="h-3.5 w-3.5 text-primary/70" />
        Notas (opcional)
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="space-y-1">
          <Label>Notas</Label>
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
            placeholder="Observaciones internas…" />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
