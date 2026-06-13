/**
 * Campos del formulario de captura de factura de proveedor.
 * Layout en secciones titulares + panel de Total destacado.
 * Es un componente controlado: el dialog dueño maneja estado y submit.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProveedorCombobox } from "./ProveedorCombobox";
import { formatCurrency } from "@/lib/formatters";
import type { Database } from "@/integrations/supabase/types";
import {
  FormSection, FieldError,
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
}

export function FacturaProveedorFormFields({
  values, onChange, onProveedor, categorias, total, errors = {},
}: Props) {
  const showTc = values.moneda !== "MXN";

  return (
    <div className="space-y-6">
      <FormSection title="Proveedor y folio">
        <div className="space-y-1">
          <Label>Proveedor *</Label>
          <ProveedorCombobox value={values.provId} onChange={onProveedor} className="w-full" />
          <FieldError msg={errors.provId} />
        </div>
        <div className="space-y-1">
          <Label>Folio del proveedor *</Label>
          <Input value={values.folio} onChange={(e) => onChange("folio", e.target.value)} placeholder="A-12345" />
          <FieldError msg={errors.folio} />
        </div>
      </FormSection>

      <FormSection title="Fechas y crédito">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Emisión</Label>
            <Input type="date" value={values.emision} onChange={(e) => onChange("emision", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Días crédito</Label>
            <Input type="number" min={0} value={values.diasCredito}
              onChange={(e) => onChange("diasCredito", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Vencimiento</Label>
            <Input type="date" value={values.vencimiento} readOnly className="bg-muted" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Moneda">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label>Tipo de cambio a MXN</Label>
              <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
                value={values.tc} onChange={(e) => onChange("tc", e.target.value)} />
              <FieldError msg={errors.tc} />
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Importes">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Subtotal</Label>
            <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
              value={values.subtotal} onChange={(e) => onChange("subtotal", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>IVA</Label>
            <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
              value={values.iva} onChange={(e) => onChange("iva", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Retenciones</Label>
            <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00"
              value={values.retenciones} onChange={(e) => onChange("retenciones", e.target.value)} />
          </div>
        </div>
        <div className="mt-3 rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
          <span className="text-xl font-semibold tabular-nums">{formatCurrency(total, values.moneda)}</span>
        </div>
        <FieldError msg={errors.subtotal} />
      </FormSection>

      <FormSection title="Categorización (opcional)">
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
      </FormSection>
    </div>
  );
}
