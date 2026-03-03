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

interface Props {
  modo: string;
  tipoEmbarque: string;
  origen: string;
  setOrigen: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  tiempoTransitoDias: number | undefined;
  setTiempoTransitoDias: (v: number | undefined) => void;
  diasLibresDestino: number;
  setDiasLibresDestino: (v: number) => void;
  diasAlmacenaje: number;
  setDiasAlmacenaje: (v: number) => void;
  cartaGarantia: boolean;
  setCartaGarantia: (v: boolean) => void;
  frecuencia: string;
  setFrecuencia: (v: string) => void;
  rutaTexto: string;
  setRutaTexto: (v: string) => void;
  validezPropuesta: Date | undefined;
  setValidezPropuesta: (v: Date | undefined) => void;
  tipoMovimiento: string;
  setTipoMovimiento: (v: string) => void;
  seguro: boolean;
  setSeguro: (v: boolean) => void;
  valorSeguroUsd: number;
  setValorSeguroUsd: (v: number) => void;
}

export default function SeccionRutaCotizacion({
  modo, tipoEmbarque,
  origen, setOrigen, destino, setDestino,
  tiempoTransitoDias, setTiempoTransitoDias,
  diasLibresDestino, setDiasLibresDestino,
  diasAlmacenaje, setDiasAlmacenaje,
  cartaGarantia, setCartaGarantia,
  frecuencia, setFrecuencia,
  rutaTexto, setRutaTexto,
  validezPropuesta, setValidezPropuesta,
  tipoMovimiento, setTipoMovimiento,
  seguro, setSeguro,
  valorSeguroUsd, setValorSeguroUsd,
}: Props) {
  const esMaritimo = modo === 'Marítimo';
  const usarPortSelect = esMaritimo || modo === 'Multimodal';

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ruta</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {usarPortSelect ? (
          <>
            <div><Label>Origen</Label><PortSelect value={origen} onValueChange={setOrigen} placeholder="Buscar puerto de origen..." /></div>
            <div><Label>Destino</Label><PortSelect value={destino} onValueChange={setDestino} placeholder="Buscar puerto de destino..." /></div>
          </>
        ) : (
          <>
            <div><Label>Origen</Label><Input value={origen} onChange={e => setOrigen(e.target.value)} placeholder="Ej. Shanghai, China" /></div>
            <div><Label>Destino</Label><Input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej. Manzanillo, México" /></div>
          </>
        )}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <Label>Tiempo de tránsito (días)</Label>
            <Input type="number" min={0} value={tiempoTransitoDias ?? ''} onChange={e => setTiempoTransitoDias(e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej. 25" />
          </div>
          {esMaritimo && tipoEmbarque === 'FCL' && (
            <>
              <div>
                <Label>Días libres en destino</Label>
                <Input type="number" min={0} value={diasLibresDestino} onChange={e => setDiasLibresDestino(Number(e.target.value))} placeholder="Ej. 7" />
              </div>
              <div>
                <Label>Carta garantía</Label>
                <Select value={cartaGarantia ? 'si' : 'no'} onValueChange={v => setCartaGarantia(v === 'si')}>
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
              <Input type="number" min={0} value={diasAlmacenaje} onChange={e => setDiasAlmacenaje(Number(e.target.value))} placeholder="Ej. 5" />
            </div>
          )}
          <div>
            <Label>Frecuencia</Label>
            <Select value={frecuencia} onValueChange={setFrecuencia}>
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
            <Input value={rutaTexto} onChange={e => setRutaTexto(e.target.value)} placeholder="Ej. Manzanillo → Los Angeles → Nueva York" />
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
                <Calendar mode="single" selected={validezPropuesta} onSelect={setValidezPropuesta} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Tipo de movimiento</Label>
            <Select value={tipoMovimiento} onValueChange={setTipoMovimiento}>
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
            <Switch checked={seguro} onCheckedChange={setSeguro} />
            <span className="text-sm text-muted-foreground">{seguro ? 'Sí' : 'No'}</span>
          </div>
          {seguro && (
            <div>
              <Label>Valor de mercancía (USD)</Label>
              <Input type="number" min={0} step={0.01} value={valorSeguroUsd} onChange={e => setValorSeguroUsd(Number(e.target.value))} placeholder="0.00" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
