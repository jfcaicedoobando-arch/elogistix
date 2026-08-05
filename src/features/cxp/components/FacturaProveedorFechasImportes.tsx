/**
 * Bloque "Fechas y crédito" + "Moneda e importes" del formulario de factura de
 * proveedor.
 *
 * v13.423.0 — Se extrajo para poder colocarlo en la columna izquierda del modal
 * de captura manual (antes esa columna quedaba vacía y la derecha obligaba a
 * hacer scroll a ciegas en pantallas de 720 px).
 */
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/shared/NumericInput";
import { FormSection } from "./facturaFormPrimitives";
import { MonedaImportesSection } from "./FacturaProveedorFormFields.moneda";
import type { FacturaFormValues, TcOrigen } from "@/features/cxp/types";

interface Props {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  errors?: Partial<Record<keyof FacturaFormValues, string>>;
  tcOrigen?: TcOrigen;
  tcFechaAplicada?: string;
  onObtenerDof?: () => void;
  dofLoading?: boolean;
}

export function FechasEImportesBlock({
  values, onChange, errors = {},
  tcOrigen = "vacio", tcFechaAplicada, onObtenerDof, dofLoading = false,
}: Props) {
  return (
    <div className="space-y-5">
      <FormSection title="Fechas y crédito" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        {/* La fecha de emisión necesita más ancho: el icono y la "x" de limpiar
            truncaban el valor a "05/08/20" en columnas de tres campos. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_0.8fr_1fr]">
          <div className="space-y-1">
            <Label>Emisión</Label>
            <DatePickerMx
              value={values.emision}
              onChange={(v) => onChange("emision", v)}
              className="w-full"
            />
            {errors?.emision && <p className="text-xs text-destructive">{errors.emision}</p>}
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
    </div>
  );
}
