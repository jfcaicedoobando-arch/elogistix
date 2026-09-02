/**
 * Dialog reutilizable para buscar Top 3 tarifas marítimas y opcionalmente
 * devolver la elegida al caller (usado en /costeo/buscar y en wizard cotización).
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { useDiagnosticoTarifas } from "@/features/costeo/hooks/useDiagnosticoTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";
import { ResultadosBody } from "./BuscarTarifaDialog.ResultadosBody";
import {
  PAISES_CN, PAISES_MX, filtrarPorPais, useFiltrosTarifa,
  type FiltrosTarifaInitial,
} from "./BuscarTarifaDialog.helpers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si se provee, se muestra botón "Elegir" en cada card y se cierra al elegir. */
  onElegir?: (row: TopTarifaRow) => void;
  selectLabel?: string;
  initial?: FiltrosTarifaInitial;
}

export function BuscarTarifaDialog({
  open, onOpenChange, onElegir, selectLabel, initial,
}: Props) {
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const { origen, setOrigen, destino, setDestino, tipo, setTipo, fecha, setFecha } =
    useFiltrosTarifa(open, initial);

  const {
    data: tarifas = [], isFetching, error, refetch, isRefetching,
    tipoContenedorIds = [],
  } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const { diagnostico } = useDiagnosticoTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorIds,
    enabled: !isFetching && !error && tarifas.length === 0,
  });

  const puertosCN = filtrarPorPais(puertos, PAISES_CN);
  const puertosMX = filtrarPorPais(puertos, PAISES_MX);
  const puertosOrigenList = puertosCN.length ? puertosCN : puertos;
  const puertosDestinoList = puertosMX.length ? puertosMX : puertos;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Search}
      title="Buscar tarifa marítima (Top 3)"
      description="Busca las tres mejores tarifas marítimas disponibles para la ruta seleccionada."
      size="4xl"
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      }
    >
      <div role="search" aria-label="Filtros de búsqueda de tarifa" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="td-origen">Puerto origen (CN)</Label>
          <Select value={origen} onValueChange={setOrigen}>
            <SelectTrigger id="td-origen"><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {puertosOrigenList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}, {p.country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="td-destino">Puerto destino (MX)</Label>
          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger id="td-destino"><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {puertosDestinoList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}, {p.country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="td-tipo">Tipo contenedor</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger id="td-tipo"><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="td-fecha">Fecha</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
      </div>

      <ResultadosBody
        origen={origen} destino={destino} tipo={tipo}
        isFetching={isFetching} tarifas={tarifas}
        error={error} onRetry={() => void refetch()} isRefetching={isRefetching}
        onElegir={onElegir} onOpenChange={onOpenChange}
        selectLabel={selectLabel}
        diagnostico={diagnostico}
      />
    </FormDialogShell>
  );
}
