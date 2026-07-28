/**
 * Sección "Flete LCL manual" — Paso 1 del wizard de cotización.
 *
 * Se renderiza solo cuando modo === "Marítimo" && tipoEmbarque === "LCL"
 * y NO hay tarifa vinculada. Captura:
 *  - Consolidador / agente LCL (proveedor).
 *  - Tarifa USD por W/M.
 *  - Mínimo de flete USD.
 *  - Días libres de almacenaje en destino.
 *
 * Muestra la venta calculada `max(WM × tarifa, minimo)` en vivo.
 * v13.299.0
 */
import { useFormContext } from "react-hook-form";
import { AlertCircle } from "lucide-react";

import { NumericInput } from "@/components/shared/NumericInput";
import { FormField } from "@/components/shared/FormField";
import { WizardSection } from "@/components/shared/WizardSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProveedoresLite } from "@/features/proveedor/hooks/useProveedores";
import { formatCurrency, formatNumber } from "@/lib/formatters/numbers";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import type { CotizacionFormValues, LclFleteManual } from "@/features/cotizacion/types";
import {
  calcularTotalesLcl,
  calcularFleteVentaLCL,
} from "@/features/cotizacion/utils/calcularWMLcl";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

interface Props {
  complete?: boolean;
}

export default function SeccionFleteManualLCL({ complete }: Props = {}) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const { data: proveedores = [] } = useProveedoresLite();

  const dimensionesLCL = watch("dimensionesLCL");
  const pesoKg = watch("pesoKg");
  const manual = watch("lclFleteManual");
  // B-075: preview con el mismo markup que se auto-cargará en el paso 2.
  const markup = useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15);

  const { totalPesoKg, totalVolumenM3, wmFacturable } = calcularTotalesLcl(dimensionesLCL, pesoKg);
  const ventaFlete = calcularFleteVentaLCL(wmFacturable, manual?.tarifaWM, manual?.minimo, markup);

  const setField = <K extends keyof LclFleteManual>(key: K, value: LclFleteManual[K]) => {
    setValue("lclFleteManual", { ...manual, [key]: value }, OPTS);
  };

  return (
    <WizardSection
      title="Flete LCL (captura manual)"
      complete={complete}
    >
      <div className="space-y-4">
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <AlertCircle className="size-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            En LCL el flete se cotiza contra un consolidador por{" "}
            <span className="font-medium text-foreground">W/M</span> (peso o
            volumen, el mayor). Vincular una tarifa es opcional: si no la
            tienes, captura aquí la tarifa negociada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Consolidador / Agente LCL" required>
            <Select
              value={manual?.consolidadorId ?? ""}
              onValueChange={(v) => setField("consolidadorId", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proveedor…" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Días libres de almacenaje">
            <NumericInput
              value={manual?.diasLibresAlmacenaje ?? 0}
              onChange={(n) => setField("diasLibresAlmacenaje", n)}
              aria-label="Días libres de almacenaje"
            />
          </FormField>

          <FormField label="Tarifa (USD por W/M)" required>
            <NumericInput
              value={manual?.tarifaWM ?? 0}
              onChange={(n) => setField("tarifaWM", n)}
              decimals
              aria-label="Tarifa por W/M en USD"
            />
          </FormField>

          <FormField label="Mínimo de flete (USD)">
            <NumericInput
              value={manual?.minimo ?? 0}
              onChange={(n) => setField("minimo", n)}
              decimals
              aria-label="Mínimo de flete en USD"
            />
          </FormField>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Peso total</p>
            <p className="font-semibold tabular-nums">
              {formatNumber(totalPesoKg)} kg
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Volumen total</p>
            <p className="font-semibold tabular-nums">
              {totalVolumenM3.toFixed(3)} m³
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">W/M facturable</p>
            <p className="font-semibold tabular-nums text-primary">
              {wmFacturable.toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Venta flete (calculada, markup incluido)</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(ventaFlete, "USD")}
            </p>
          </div>
        </div>
      </div>
    </WizardSection>
  );
}
