/**
 * Campos del formulario de captura de factura de proveedor.
 * Inputs numéricos sin spinners (NumericInput), secciones con iconos
 * y agrupación moneda+importes. El total vive en el header del dialog.
 */
import { CalendarDays, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import { FormSection, FieldError, RequiredMark } from "./facturaFormPrimitives";
import type {
  FacturaFormValues,
  CategoriaPresupuestoLite,
  TcOrigen,
} from "@/features/cxp/types";
import { ProveedorYFolioSection, NotasSection } from "./FacturaProveedorFormFields.sections";
import { MonedaImportesSection } from "./FacturaProveedorFormFields.moneda";


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


export function FacturaProveedorFormFields({
  values, onChange, onProveedor, categorias, errors = {},
  proveedorReadOnly = false, proveedorNombre,
  tcOrigen = "vacio", tcFechaAplicada, onObtenerDof, dofLoading = false,
}: Props) {
  

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

      <MonedaImportesSection
        values={values}
        onChange={onChange}
        errors={errors}
        tcOrigen={tcOrigen}
        tcFechaAplicada={tcFechaAplicada}
        onObtenerDof={onObtenerDof}
        dofLoading={dofLoading}
      />

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

      <NotasSection value={values.notas} onChange={(v) => onChange("notas", v)} />
    </div>
  );
}


