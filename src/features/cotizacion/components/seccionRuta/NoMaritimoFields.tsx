import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { FormField } from "@/components/shared/FormField";
import { PLACEHOLDER_FECHA } from "@/components/ui/picker-mx-shell";
import { TransitoField, FclLclFields } from "./TarifaFields";
import SeguroBlock from "./SeguroBlock";
import type { TarifaCtx } from "./overrideHelpers";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

interface Props {
  ctx: UseFormReturn<CotizacionFormValues>;
  tarifaCtx: TarifaCtx;
  tarifaHasta: Date | null;
}

export default function NoMaritimoFields({ ctx, tarifaCtx, tarifaHasta }: Props) {
  const { watch, setValue } = ctx;
  const seguro = watch("seguro");
  const validezPropuesta = watch("validezPropuesta");
  const tipoEmbarque = watch("tipoEmbarque");

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <>
      <TransitoField ctx={ctx} tarifaCtx={tarifaCtx} />

      <FormField label="Frecuencia">
        <Select value={watch("frecuencia")} onValueChange={v => setValue("frecuencia", v)}>
          <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Diaria">Diaria</SelectItem>
            <SelectItem value="Semanal">Semanal</SelectItem>
            <SelectItem value="Quincenal">Quincenal</SelectItem>
            <SelectItem value="Mensual">Mensual</SelectItem>
            <SelectItem value="Bajo demanda">Bajo demanda</SelectItem>
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
              {validezPropuesta ? format(validezPropuesta, "dd/MM/yyyy") : PLACEHOLDER_FECHA}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={validezPropuesta}
              onSelect={d => setValue("validezPropuesta", d, { shouldValidate: true, shouldDirty: true })}
              disabled={(date) => date < hoy || (!!tarifaHasta && date > tarifaHasta)}
              autoFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </FormField>

      <SeguroBlock ctx={ctx} seguro={seguro} />

      {tipoEmbarque && <FclLclFields ctx={ctx} tipoEmbarque={tipoEmbarque} tarifaCtx={tarifaCtx} />}
    </>
  );
}
