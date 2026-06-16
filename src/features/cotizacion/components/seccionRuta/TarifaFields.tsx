import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { HeredadoBadge } from "@/components/shared/HeredadoBadge";
import CartaGarantiaBadge from "@/features/cotizacion/components/CartaGarantiaBadge";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
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
        />
        {tarifaCtx.tieneTarifa && tarifaCtx.hasTransito && (
          <HeredadoBadge tipoOrigen="tarifa" origen="vinculada" className="shrink-0" />
        )}
      </div>
    </FormField>
  );
}

function CartaGarantiaSlot({ ctx, tarifaCtx }: { ctx: Ctx; tarifaCtx: TarifaCtx }) {
  const { watch, setValue } = ctx;
  const tarifaId = watch("tarifaId");
  const { data: tarifa } = useTarifaVinculada(tarifaId);

  if (tarifaCtx.hasCartaGarantia && tarifa) {
    return (
      <FormField label="Carta garantía">
        <div className="flex items-center gap-2 h-10">
          <CartaGarantiaBadge tarifa={tarifa} />
        </div>
      </FormField>
    );
  }
  return (
    <FormField label="Carta garantía">
      <Select value={watch("cartaGarantia") ? 'si' : 'no'} onValueChange={v => { marcarOverride(ctx, "cartaGarantia"); setValue("cartaGarantia", v === 'si', OPTS); }}>
        <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="si">Sí</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function FclLclFields({ ctx, tipoEmbarque, tarifaCtx }: { ctx: Ctx; tipoEmbarque: string; tarifaCtx: TarifaCtx }) {
  const { watch, setValue } = ctx;
  if (tipoEmbarque === 'FCL') {
    return (
      <>
        <FormField label="Días libres en destino">
          <div className="flex gap-2 items-center">
            <Input
              type="number" min={0}
              value={watch("diasLibresDestino")}
              onChange={e => { marcarOverride(ctx, "diasLibresDestino"); setValue("diasLibresDestino", Number(e.target.value), OPTS); }}
              placeholder="Ej. 7"
              readOnly={tarifaCtx.hasDiasLibres}
              className={tarifaCtx.hasDiasLibres ? "bg-muted/40" : undefined}
            />
            {tarifaCtx.tieneTarifa && tarifaCtx.hasDiasLibres && (
              <Badge variant="outline" className="gap-1 shrink-0"><Link2 className="h-3 w-3" /> Tarifa</Badge>
            )}
          </div>
        </FormField>
        <CartaGarantiaSlot ctx={ctx} tarifaCtx={tarifaCtx} />
      </>
    );
  }
  if (tipoEmbarque === 'LCL') {
    return (
      <FormField label="Días libres de almacenaje">
        <Input type="number" min={0} value={watch("diasAlmacenaje")} onChange={e => setValue("diasAlmacenaje", Number(e.target.value), OPTS)} placeholder="Ej. 5" />
      </FormField>
    );
  }
  return null;
}
