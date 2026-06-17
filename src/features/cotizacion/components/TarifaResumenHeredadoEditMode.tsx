/**
 * Modo "Editar manual" de TarifaResumenHeredado. Extraído para mantener
 * el componente padre ≤200 líneas (Power of 10).
 */
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { marcarOverride, OPTS } from "./seccionRuta/overrideHelpers";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

export interface EditModeProps {
  form: ReturnType<typeof useFormContext<CotizacionFormValues>>;
  tipoEmbarque: string | undefined;
  transito: number | undefined;
  frecuencia: string | undefined;
  diasLibres: number | undefined;
  diasAlmacenaje: number | undefined;
  override: Record<string, unknown>;
}

export default function TarifaResumenHeredadoEditMode({
  form, tipoEmbarque, transito, frecuencia, diasLibres, diasAlmacenaje, override,
}: EditModeProps) {
  const { watch, setValue } = form;
  const esFCL = tipoEmbarque === "FCL";
  const esLCL = tipoEmbarque === "LCL";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Tiempo de tránsito (días)</span>
        <Input
          type="number" min={0}
          value={transito ?? ""}
          onChange={e => { marcarOverride(form, "tiempoTransitoDias"); setValue("tiempoTransitoDias", e.target.value ? Number(e.target.value) : undefined, OPTS); }}
        />
        {Boolean(override.tiempoTransitoDias) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
      </label>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">Frecuencia</span>
        <Select value={frecuencia ?? ""} onValueChange={v => { marcarOverride(form, "frecuencia"); setValue("frecuencia", v, OPTS); }}>
          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Diaria">Diaria</SelectItem>
            <SelectItem value="Semanal">Semanal</SelectItem>
            <SelectItem value="Quincenal">Quincenal</SelectItem>
            <SelectItem value="Mensual">Mensual</SelectItem>
            <SelectItem value="Bajo demanda">Bajo demanda</SelectItem>
          </SelectContent>
        </Select>
        {Boolean(override.frecuencia) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
      </label>
      {esFCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Días libres en destino (demoras)</span>
          <Input
            type="number" min={0}
            value={diasLibres ?? ""}
            onChange={e => { marcarOverride(form, "diasLibresDestino"); setValue("diasLibresDestino", Number(e.target.value), OPTS); }}
          />
          {Boolean(override.diasLibresDestino) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
      {esLCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Días libres de almacenaje</span>
          <Input
            type="number" min={0}
            value={diasAlmacenaje ?? ""}
            onChange={e => { marcarOverride(form, "diasAlmacenaje"); setValue("diasAlmacenaje", Number(e.target.value), OPTS); }}
          />
          {Boolean(override.diasAlmacenaje) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
      {esFCL && (
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Carta garantía</span>
          <Select value={watch("cartaGarantia") ? "si" : "no"} onValueChange={v => { marcarOverride(form, "cartaGarantia"); setValue("cartaGarantia", v === "si", OPTS); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          {Boolean(override.cartaGarantia) && <span className="text-xs text-warning">Sobreescrito manualmente</span>}
        </label>
      )}
    </div>
  );
}
