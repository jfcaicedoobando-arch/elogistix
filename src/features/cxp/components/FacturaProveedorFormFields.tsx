/**
 * Campos del formulario de captura de factura de proveedor.
 * Inputs numéricos sin spinners (NumericInput), secciones con iconos
 * y agrupación moneda+importes. El total vive en el header del dialog.
 */
import { CalendarDays, Coins, FileText, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import type { Database } from "@/integrations/supabase/types";
import { FormSection, FieldError, RequiredMark } from "./facturaFormPrimitives";
import type {
  FacturaFormValues,
  CategoriaPresupuestoLite,
  TcOrigen,
} from "@/features/cxp/types";
import { ProveedorYFolioSection, NotasSection } from "./FacturaProveedorFormFields.sections";
import { TcOrigenHint } from "./FacturaProveedorFormFields.hint";

type Moneda = Database["public"]["Enums"]["moneda"];



interface Props {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  onProveedor: (id: string, nombre: string, diasCredito?: number) => void;
  categorias: CategoriaPresupuestoLite[];
  total: number;
  errors?: Partial<Record<keyof FacturaFormValues, string>>;
  /** Modo edición: oculta el combobox y muestra el proveedor como read-only. */
  proveedorReadOnly?: boolean;
  proveedorNombre?: string;
  /** Origen actual del valor `tc` — controla el hint debajo del input. */
  tcOrigen?: TcOrigen;
  /** Fecha (YYYY-MM-DD) del FIX efectivamente aplicado por Banxico. */
  tcFechaAplicada?: string;
  /** Handler del botón "Obtener DOF". Si se omite, no se renderiza el botón. */
  onObtenerDof?: () => void;
  /** Estado de carga del auto-fetch/click del botón "Obtener DOF". */
  dofLoading?: boolean;
}

const toNum = (s: string) => (s === "" ? 0 : Number(s) || 0);
const fromNum = (n: number) => (n === 0 ? "" : String(n));

export function FacturaProveedorFormFields({
  values, onChange, onProveedor, categorias, errors = {},
  proveedorReadOnly = false, proveedorNombre,
  tcOrigen = "vacio", tcFechaAplicada, onObtenerDof, dofLoading = false,
}: Props) {
  const showTc = values.moneda !== "MXN";


  return (
    <div className="space-y-5">
      <ProveedorYFolioSection
        values={values}
        onChange={onChange}
        onProveedor={onProveedor}
        errors={errors}
        proveedorReadOnly={proveedorReadOnly}
        proveedorNombre={proveedorNombre}
      />

      <Separator />

      <FormSection title="Fechas y crédito" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Emisión</Label>
            <DatePickerMx value={values.emision} onChange={(v) => onChange("emision", v)} className="w-full" />
            {errors?.emision && (
              <p className="text-xs text-destructive">{errors.emision}</p>
            )}
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
            <Input
              value={values.vencimiento ? values.vencimiento.split("-").reverse().join("/") : ""}
              readOnly
              className="bg-muted"
            />
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
              <div className="flex items-center justify-between gap-2">
                <Label>Tipo de cambio a MXN<RequiredMark /></Label>
                {onObtenerDof && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-2xs"
                    onClick={onObtenerDof}
                    disabled={dofLoading}
                    title="Consulta la Publicación DOF Banxico vigente en la fecha de emisión."
                  >
                    {dofLoading
                      ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      : <RefreshCw className="h-3 w-3 mr-1" />}
                    Obtener DOF
                  </Button>
                )}
              </div>
              <NumericInput
                value={toNum(values.tc)}
                onChange={(n) => onChange("tc", fromNum(n))}
                decimals
                aria-label="Tipo de cambio a MXN"
              />
              <TcOrigenHint origen={tcOrigen} fechaAplicada={tcFechaAplicada} />
              <FieldError msg={errors.tc} />
            </div>
          )}

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Subtotal<RequiredMark /></Label>
            <NumericInput value={toNum(values.subtotal)} onChange={(n) => onChange("subtotal", fromNum(n))} decimals aria-label="Subtotal" />
          </div>
          <div className="space-y-1">
            <Label>IVA</Label>
            <NumericInput value={toNum(values.iva)} onChange={(n) => onChange("iva", fromNum(n))} decimals aria-label="IVA" />
          </div>
          <div className="space-y-1">
            <Label>IEPS</Label>
            <NumericInput value={toNum(values.ieps)} onChange={(n) => onChange("ieps", fromNum(n))} decimals aria-label="IEPS" />
          </div>
          <div className="space-y-1">
            <Label>Retenciones</Label>
            <NumericInput value={toNum(values.retenciones)} onChange={(n) => onChange("retenciones", fromNum(n))} decimals aria-label="Retenciones" />
          </div>
        </div>
        <FieldError msg={errors.subtotal} />
      </FormSection>

      <Separator />

      <FormSection title="Categoría contable" icon={<FileText className="h-3.5 w-3.5" />}>
        <div className="space-y-1">
          <Label>Categoría contable<RequiredMark /></Label>
          <Select value={values.categoriaId || ""} onValueChange={(v) => onChange("categoriaId", v)}>
            <SelectTrigger aria-required="true">
              <SelectValue placeholder="Selecciona la categoría contable de esta factura" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-label text-muted-foreground">
            Un mismo proveedor puede emitir facturas para distintas categorías (COGS, gastos operativos, OpEx).
          </p>
          <FieldError msg={errors.categoriaId} />
        </div>
      </FormSection>

      <Separator />

      <NotasSection value={values.notas} onChange={(v) => onChange("notas", v)} />
    </div>
  );
}


