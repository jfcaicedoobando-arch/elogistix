import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import PortSelect from "@/components/PortSelect";
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";

export default function SeccionRutaCotizacion() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();

  const modo = watch("modo");
  const tipoEmbarque = watch("tipoEmbarque");
  const seguro = watch("seguro");
  const validezPropuesta = watch("validezPropuesta");

  const esMaritimo = modo === 'Marítimo';
  const usarPortSelect = esMaritimo || modo === 'Multimodal';

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ruta</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {usarPortSelect ? (
          <>
            <div><Label>Origen</Label><PortSelect value={watch("origen")} onValueChange={v => setValue("origen", v)} placeholder="Buscar puerto de origen..." /></div>
            <div><Label>Destino</Label><PortSelect value={watch("destino")} onValueChange={v => setValue("destino", v)} placeholder="Buscar puerto de destino..." /></div>
          </>
        ) : (
          <>
            <div><Label>Origen</Label><Input value={watch("origen")} onChange={e => setValue("origen", e.target.value)} placeholder="Ej. Shanghai, China" /></div>
            <div><Label>Destino</Label><Input value={watch("destino")} onChange={e => setValue("destino", e.target.value)} placeholder="Ej. Manzanillo, México" /></div>
          </>
        )}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <Label>Tiempo de tránsito (días)</Label>
            <Input type="number" min={0} value={watch("tiempoTransitoDias") ?? ''} onChange={e => setValue("tiempoTransitoDias", e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej. 25" />
          </div>
          {esMaritimo && tipoEmbarque === 'FCL' && (
            <>
              <div>
                <Label>Días libres en destino</Label>
                <Input type="number" min={0} value={watch("diasLibresDestino")} onChange={e => setValue("diasLibresDestino", Number(e.target.value))} placeholder="Ej. 7" />
              </div>
              <div>
                <Label>Carta garantía</Label>
                <Select value={watch("cartaGarantia") ? 'si' : 'no'} onValueChange={v => setValue("cartaGarantia", v === 'si')}>
                  <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {esMaritimo && tipoEmbarque === 'LCL' && (
            <div>
              <Label>Días libres de almacenaje</Label>
              <Input type="number" min={0} value={watch("diasAlmacenaje")} onChange={e => setValue("diasAlmacenaje", Number(e.target.value))} placeholder="Ej. 5" />
            </div>
          )}
          <div>
            <Label>Frecuencia</Label>
            <Select value={watch("frecuencia")} onValueChange={v => setValue("frecuencia", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Diaria">Diaria</SelectItem>
                <SelectItem value="Semanal">Semanal</SelectItem>
                <SelectItem value="Quincenal">Quincenal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Ruta</Label>
            <Input value={watch("rutaTexto")} onChange={e => setValue("rutaTexto", e.target.value)} placeholder="Ej. Manzanillo → Los Angeles → Nueva York" />
          </div>
          <div>
            <Label>Validez de la propuesta</Label>
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
          </div>
          <div>
            <Label>Tipo de movimiento</Label>
            <Select value={watch("tipoMovimiento")} onValueChange={v => setValue("tipoMovimiento", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CY-CY">CY-CY</SelectItem>
                <SelectItem value="CY-DR">CY-DR</SelectItem>
                <SelectItem value="DR-DR">DR-DR</SelectItem>
                <SelectItem value="DR-CY">DR-CY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Label>Seguro</Label>
            <Switch checked={seguro} onCheckedChange={v => setValue("seguro", v)} />
            <span className="text-sm text-muted-foreground">{seguro ? 'Sí' : 'No'}</span>
          </div>
          {seguro && (
            <div>
              <Label>Valor de mercancía (USD)</Label>
              <Input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={watch("valorSeguroUsd") || ''} onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setValue("valorSeguroUsd", Number(v) || 0); }} placeholder="0.00" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
