import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import OrigenDestinoBlock from "./seccionRuta/OrigenDestinoBlock";
import { TransitoField, FclLclFields } from "./seccionRuta/TarifaFields";
import SeguroBlock from "./seccionRuta/SeguroBlock";
import BannerOverride from "./seccionRuta/BannerOverride";
import type { TarifaCtx } from "./seccionRuta/overrideHelpers";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

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
