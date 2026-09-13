import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { HeredadoBadge } from "@/components/shared/HeredadoBadge";
import { OPTS, marcarOverride, type Ctx, type TarifaCtx } from "./overrideHelpers";

export function TransitoField({ ctx, tarifaCtx }: { ctx: Ctx; tarifaCtx: TarifaCtx }) {
  const { watch, setValue } = ctx;
  const value = watch("tiempoTransitoDias");
  const locked = tarifaCtx.hasTransito && !tarifaCtx.tieneTarifa ? false : tarifaCtx.hasTransito;
  return (
    <FormField label="Tiempo de tránsito (días)">
      <div className="flex gap-2 items-center">
        <Input
          type="number" min={0}
          value={value ?? ''}
          onChange={e => { marcarOverride(ctx, "tiempoTransitoDias"); setValue("tiempoTransitoDias", e.target.value ? Number(e.target.value) : undefined, OPTS); }}
          placeholder="Ej. 25"
          readOnly={locked}
          className={locked ? "bg-muted/40" : undefined}
          aria-label="Tiempo de tránsito en días"
        />
        {tarifaCtx.tieneTarifa && tarifaCtx.hasTransito && (
          <HeredadoBadge tipoOrigen="tarifa" origen="vinculada" className="shrink-0" />
        )}
      </div>
    </FormField>
  );
}
