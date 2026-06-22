/**
 * Campos del formulario de captura de factura de proveedor.
 * Inputs numéricos sin spinners (NumericInput), secciones con iconos
 * y agrupación moneda+importes. El total vive en el header del dialog.
 */
import { useState } from "react";
import { Building2, CalendarDays, Coins, FileText, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NumericInput } from "@/components/shared/NumericInput";
import { ProveedorCombobox } from "./ProveedorCombobox";
import type { Database } from "@/integrations/supabase/types";
import {
  FormSection, FieldError, RequiredMark,
  type FacturaFormValues, type CategoriaPresupuestoLite,
} from "./facturaFormPrimitives";

type Moneda = Database["public"]["Enums"]["moneda"];

export type { FacturaFormValues };

interface Props {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  onProveedor: (id: string, nombre: string) => void;
  categorias: CategoriaPresupuestoLite[];
  total: number;
  errors?: Partial<Record<keyof FacturaFormValues, string>>;
  /** Modo edición: oculta el combobox y muestra el proveedor como read-only. */
  proveedorReadOnly?: boolean;
  proveedorNombre?: string;
}

const toNum = (s: string) => (s === "" ? 0 : Number(s) || 0);
const fromNum = (n: number) => (n === 0 ? "" : String(n));

export function FacturaProveedorFormFields({
  values, onChange, onProveedor, categorias, errors = {},
  proveedorReadOnly = false, proveedorNombre,
}: Props) {
  const [openDetalles, setOpenDetalles] = useState(false);
  const showTc = values.moneda !== "MXN";

  return (
    <div className="space-y-5">
      <FormSection
        title={proveedorReadOnly ? "Folio del proveedor" : "Proveedor y folio"}
        icon={<Building2 className="h-3.5 w-3.5" />}
      >
        {proveedorReadOnly ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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

      <Separator />

      <FormSection title="Fechas y crédito" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Emisión</Label>
            <Input type="date" value={values.emision} onChange={(e) => onChange("emision", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Días crédito</Label>
            <NumericInput
              value={values.diasCredito}
              onChange={(n) => onChange("diasCredito", n)}
              aria-label="Días de crédito"
            />
          </div>
          <div className="space-y-1">
            <Label>Vencimiento</Label>
            <Input type="date" value={values.vencimiento} readOnly className="bg-muted" />
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Moneda e importes" icon={<Coins className="h-3.5 w-3.5" />}>
        <div className={`grid grid-cols-1 gap-3 ${showTc ? "sm:grid-cols-2" : ""}`}>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={values.moneda} onValueChange={(v) => onChange("moneda", v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showTc && (
            <div className="space-y-1">
              <Label>Tipo de cambio a MXN<RequiredMark /></Label>
              <NumericInput
                value={toNum(values.tc)}
                onChange={(n) => onChange("tc", fromNum(n))}
                decimals
                aria-label="Tipo de cambio a MXN"
              />
              <FieldError msg={errors.tc} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Subtotal<RequiredMark /></Label>
            <NumericInput
              value={toNum(values.subtotal)}
              onChange={(n) => onChange("subtotal", fromNum(n))}
              decimals
              aria-label="Subtotal"
            />
          </div>
          <div className="space-y-1">
            <Label>IVA</Label>
            <NumericInput
              value={toNum(values.iva)}
              onChange={(n) => onChange("iva", fromNum(n))}
              decimals
              aria-label="IVA"
            />
          </div>
          <div className="space-y-1">
            <Label>Retenciones</Label>
            <NumericInput
              value={toNum(values.retenciones)}
              onChange={(n) => onChange("retenciones", fromNum(n))}
              decimals
              aria-label="Retenciones"
            />
          </div>
        </div>
        <FieldError msg={errors.subtotal} />
      </FormSection>

      <Separator />

      <Collapsible open={openDetalles} onOpenChange={setOpenDetalles}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <FileText className="h-3.5 w-3.5 text-primary/70" />
          Detalles adicionales (opcional)
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDetalles ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="space-y-1">
            <Label>Categoría presupuestal</Label>
            <Select
              value={values.categoriaId || "ninguna"}
              onValueChange={(v) => onChange("categoriaId", v === "ninguna" ? "" : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea value={values.notas} onChange={(e) => onChange("notas", e.target.value)} rows={2}
              placeholder="Observaciones internas…" />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
