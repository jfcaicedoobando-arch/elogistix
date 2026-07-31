/**
 * Sección "Moneda e importes" del formulario de factura de proveedor.
 * Extraída de FacturaProveedorFormFields para respetar el límite de 200 líneas.
 */
import { Coins, Loader2, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import type { Database } from "@/integrations/supabase/types";
import { FormSection, FieldError, RequiredMark } from "./facturaFormPrimitives";
import type { FacturaFormValues, TcOrigen } from "@/features/cxp/types";
import { TcOrigenHint } from "./FacturaProveedorFormFields.hint";

type Moneda = Database["public"]["Enums"]["moneda"];

const toNum = (s: string) => (s === "" ? 0 : Number(s) || 0);
const fromNum = (n: number) => (n === 0 ? "" : String(n));

interface MonedaImportesSectionProps {
  values: FacturaFormValues;
  onChange: <K extends keyof FacturaFormValues>(k: K, v: FacturaFormValues[K]) => void;
  errors?: Partial<Record<keyof FacturaFormValues, string>>;
  tcOrigen?: TcOrigen;
  tcFechaAplicada?: string;
  onObtenerDof?: () => void;
  dofLoading?: boolean;
}

export function MonedaImportesSection({
  values,
  onChange,
  errors = {},
  tcOrigen = "vacio",
  tcFechaAplicada,
  onObtenerDof,
  dofLoading = false,
}: MonedaImportesSectionProps) {
  const showTc = values.moneda !== "MXN";

  return (
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
  );
}
