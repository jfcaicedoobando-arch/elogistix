import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Link2, Pencil } from "lucide-react";
import PortSelect from "@/features/catalogos/components/PortSelect";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import CartaGarantiaBadge from "@/features/cotizacion/components/CartaGarantiaBadge";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import type { UseFormReturn } from "react-hook-form";

type Ctx = UseFormReturn<CotizacionFormValues>;

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

function marcarOverride(ctx: Ctx, campo: string) {
  const actual = ctx.getValues("tarifaOverride") ?? {};
  ctx.setValue("tarifaOverride", { ...actual, [campo]: true }, OPTS);
}

function OrigenDestinoBlock({
  ctx, usarPortSelect, esTerrestre, conPuntoIntermedio,
}: { ctx: Ctx; usarPortSelect: boolean; esTerrestre: boolean; conPuntoIntermedio: boolean }) {
  const { watch, setValue } = ctx;
  if (usarPortSelect) {
    return (
      <>
        <FormField label="Origen">
          <PortSelect value={watch("origen")} onValueChange={v => setValue("origen", v)} placeholder="Buscar puerto de origen..." />
        </FormField>
        <FormField label="Destino">
          <PortSelect value={watch("destino")} onValueChange={v => setValue("destino", v)} placeholder="Buscar puerto de destino..." />
        </FormField>
      </>
    );
  }
  const placeholderOrigen = esTerrestre ? "Ej. CDMX" : "Ej. Shanghai, China";
  const placeholderDestino = esTerrestre ? "Ej. Monterrey" : "Ej. Manzanillo, México";
  return (
    <>
      <FormField label="Origen">
        <Input value={watch("origen")} onChange={e => setValue("origen", e.target.value)} placeholder={placeholderOrigen} />
      </FormField>
      {conPuntoIntermedio && (
        <FormField label="Punto de carga/descarga">
          <Input
            value={watch("puntoIntermedio")}
            onChange={e => setValue("puntoIntermedio", e.target.value, OPTS)}
            placeholder="Ej. Terminal Pantaco"
          />
        </FormField>
      )}
      <FormField label="Destino">
        <Input value={watch("destino")} onChange={e => setValue("destino", e.target.value)} placeholder={placeholderDestino} />
      </FormField>
    </>
  );
}

interface TarifaCtx {
  tieneTarifa: boolean;
  hasTransito: boolean;
  hasDiasLibres: boolean;
  hasCartaGarantia: boolean;
}

function TransitoField({ ctx, tarifaCtx }: { ctx: Ctx; tarifaCtx: TarifaCtx }) {
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
          <Badge variant="outline" className="gap-1 shrink-0">
            <Link2 className="h-3 w-3" /> Tarifa
          </Badge>
        )}
      </div>
    </FormField>
  );
}

function FclLclFields({ ctx, tipoEmbarque, tarifaCtx }: { ctx: Ctx; tipoEmbarque: string; tarifaCtx: TarifaCtx }) {
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

function SeguroBlock({ ctx, seguro }: { ctx: Ctx; seguro: boolean }) {
  const { watch, setValue } = ctx;
  return (
    <>
      <div className="flex items-center gap-3 pt-6">
        <Label className="text-sm font-medium">Seguro</Label>
        <Switch checked={seguro} onCheckedChange={v => setValue("seguro", v)} />
        <span className="text-sm text-muted-foreground">{seguro ? 'Sí' : 'No'}</span>
      </div>
      {seguro && (
        <FormField label="Valor de mercancía (USD)">
          <Input
            type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
            value={watch("valorSeguroUsd") || ''}
            onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setValue("valorSeguroUsd", Number(v) || 0); }}
            placeholder="0.00"
          />
        </FormField>
      )}
    </>
  );
}

function BannerOverride({ ctx }: { ctx: Ctx }) {
  const { watch, setValue } = ctx;
  const tarifaId = watch("tarifaId");
  const override = watch("tarifaOverride") ?? {};
  const campos = Object.keys(override).filter(k => override[k]);
  if (!tarifaId || campos.length === 0) return null;

  const limpiar = () => setValue("tarifaOverride", {}, OPTS);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
      <span className="flex items-center gap-2 text-warning">
        <Pencil className="h-3.5 w-3.5" />
        Sobrescribiste {campos.length} campo(s) de la tarifa: <strong>{campos.join(", ")}</strong>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={limpiar}>Restaurar desde tarifa</Button>
    </div>
  );
}

export default function SeccionRutaCotizacion() {
  const ctx = useFormContext<CotizacionFormValues>();
  const { watch, setValue } = ctx;

  const modo = watch("modo");
  const tipoEmbarque = watch("tipoEmbarque");
  const seguro = watch("seguro");
  const validezPropuesta = watch("validezPropuesta");
  const modalidadEquipo = watch("modalidadEquipo");
  const tarifaId = watch("tarifaId");

  const esMaritimo = modo === 'Marítimo';
  const esTerrestre = modo === 'Terrestre';
  const usarPortSelect = esMaritimo || modo === 'Multimodal';
  const conPuntoIntermedio = esTerrestre && modalidadEquipo === 'Porta Contenedor';

  const tieneTarifa = !!tarifaId;
  const override = watch("tarifaOverride") ?? {};
  const tarifaCtx: TarifaCtx = {
    tieneTarifa,
    hasTransito: tieneTarifa && !override.tiempoTransitoDias,
    hasDiasLibres: tieneTarifa && !override.diasLibresDestino,
    hasCartaGarantia: tieneTarifa && !override.cartaGarantia,
  };

  return (
    <WizardSection title="Ruta">
      <BannerOverride ctx={ctx} />
      <div className={`grid grid-cols-1 gap-4 ${conPuntoIntermedio ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <OrigenDestinoBlock ctx={ctx} usarPortSelect={usarPortSelect} esTerrestre={esTerrestre} conPuntoIntermedio={conPuntoIntermedio} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        <TransitoField ctx={ctx} tarifaCtx={tarifaCtx} />

        {esMaritimo && <FclLclFields ctx={ctx} tipoEmbarque={tipoEmbarque} tarifaCtx={tarifaCtx} />}

        <FormField label="Frecuencia">
          <Select value={watch("frecuencia")} onValueChange={v => setValue("frecuencia", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Diaria">Diaria</SelectItem>
              <SelectItem value="Semanal">Semanal</SelectItem>
              <SelectItem value="Quincenal">Quincenal</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Ruta" span={2}>
          <Input value={watch("rutaTexto")} onChange={e => setValue("rutaTexto", e.target.value)} placeholder="Ej. Manzanillo → Los Angeles → Nueva York" />
        </FormField>

        <FormField label="Validez de la propuesta">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !validezPropuesta && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {validezPropuesta ? format(validezPropuesta, "dd/MM/yyyy") : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={validezPropuesta} onSelect={d => setValue("validezPropuesta", d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </FormField>

        {!esTerrestre && (
          <FormField label="Tipo de movimiento">
            <Select value={watch("tipoMovimiento")} onValueChange={v => setValue("tipoMovimiento", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CY-CY">CY-CY</SelectItem>
                <SelectItem value="CY-DR">CY-DR</SelectItem>
                <SelectItem value="DR-DR">DR-DR</SelectItem>
                <SelectItem value="DR-CY">DR-CY</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}

        <SeguroBlock ctx={ctx} seguro={seguro} />
      </div>
    </WizardSection>
  );
}
