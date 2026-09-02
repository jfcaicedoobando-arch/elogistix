/**
 * Dialog reutilizable para buscar Top 3 tarifas marítimas y opcionalmente
 * devolver la elegida al caller (usado en /costeo/buscar y en wizard cotización).
 * Migrado a FormDialogShell (Ola 2 — Costeo).
 */
import { useEffect, useState } from "react";
import { Search, MapPinned } from "lucide-react";
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
import { TarifasSinResultado } from "./TarifasSinResultado";
import type { DiagnosticoTarifas } from "@/features/costeo/services/diagnosticoTarifas";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { TarifaResultCard } from "./TarifaResultCard";
import { computeRankingMeta } from "@/features/costeo/utils/rankingLabels";
import type { TopTarifaRow } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si se provee, se muestra botón "Elegir" en cada card y se cierra al elegir. */
  onElegir?: (row: TopTarifaRow) => void;
  selectLabel?: string;
  initial?: { puertoOrigenId?: string; puertoDestinoId?: string; tipoContenedorId?: string };
}

interface ResultadosBodyProps {
  origen: string;
  destino: string;
  tipo: string;
  isFetching: boolean;
  tarifas: TopTarifaRow[];
  error?: unknown;
  onRetry?: () => void;
  isRefetching?: boolean;
  onElegir?: (row: TopTarifaRow) => void;
  onOpenChange: (v: boolean) => void;
  selectLabel?: string;
  diagnostico?: DiagnosticoTarifas;
}

function ResultadosBody({
  origen, destino, tipo, isFetching, tarifas, error, onRetry, isRefetching,
  onElegir, onOpenChange, selectLabel, diagnostico,
}: ResultadosBodyProps) {
  if (!origen || !destino || !tipo) {
    return (
      <EmptyStateInline
        icon={MapPinned}
        message="Selecciona origen, destino y tipo de contenedor para ver tarifas."
      />
    );
  }
  if (isFetching) {
    return <EmptyStateInline loading message="Buscando…" />;
  }
  if (error) {
    return (
      <ErrorStateInline
        message={getErrorMessage(error)}
        onRetry={onRetry}
        retrying={isRefetching}
      />
    );
  }
  if (tarifas.length === 0) {
    return <TarifasSinResultado diagnostico={diagnostico} />;
  }
  const meta = computeRankingMeta(tarifas);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
      {tarifas.map((t, i) => (
        <TarifaResultCard
          key={t.id}
          row={t}
          rank={i + 1}
          meta={meta[i]}
          onElegir={onElegir ? (row) => { onElegir(row); onOpenChange(false); } : undefined}
          selectLabel={selectLabel}
        />
      ))}
    </div>
  );
}

export function BuscarTarifaDialog({
  open, onOpenChange, onElegir, selectLabel, initial,
}: Props) {
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const [origen, setOrigen] = useState(initial?.puertoOrigenId ?? "");
  const [destino, setDestino] = useState(initial?.puertoDestinoId ?? "");
  const [tipo, setTipo] = useState(initial?.tipoContenedorId ?? "");
  const [fecha, setFecha] = useState(todayLocalISO());

  useEffect(() => {
    if (open) {
      setOrigen(initial?.puertoOrigenId ?? "");
      setDestino(initial?.puertoDestinoId ?? "");
      setTipo(initial?.tipoContenedorId ?? "");
    }
  }, [open, initial?.puertoOrigenId, initial?.puertoDestinoId, initial?.tipoContenedorId]);

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

  const isCN = (c: string | null | undefined) => c === "CN" || c === "China";
  const isMX = (c: string | null | undefined) => c === "MX" || c === "Mexico" || c === "México";
  const puertosCN = puertos.filter((p) => isCN(p.country));
  const puertosMX = puertos.filter((p) => isMX(p.country));
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
