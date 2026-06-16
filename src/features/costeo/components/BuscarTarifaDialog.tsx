/**
 * Dialog reutilizable para buscar Top 3 tarifas marítimas y opcionalmente
 * devolver la elegida al caller (usado en /costeo/buscar y en wizard cotización).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { TarifaResultCard } from "./TarifaResultCard";
import type { TopTarifaRow } from "@/features/costeo/types";

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
  onElegir?: (row: TopTarifaRow) => void;
  onOpenChange: (v: boolean) => void;
  selectLabel?: string;
}

function ResultadosBody({
  origen, destino, tipo, isFetching, tarifas, onElegir, onOpenChange, selectLabel,
}: ResultadosBodyProps) {
  if (!origen || !destino || !tipo) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Selecciona ruta y tipo de contenedor para ver las tarifas vigentes.
      </p>
    );
  }
  if (isFetching) {
    return <p className="text-sm text-muted-foreground text-center py-8">Buscando…</p>;
  }
  if (tarifas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay tarifas vigentes para esta combinación. Captura una nueva en
        "Tarifas marítimas".
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {tarifas.map((t, i) => (
        <TarifaResultCard
          key={t.id}
          row={t}
          rank={i + 1}
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
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setOrigen(initial?.puertoOrigenId ?? "");
      setDestino(initial?.puertoDestinoId ?? "");
      setTipo(initial?.tipoContenedorId ?? "");
    }
  }, [open, initial?.puertoOrigenId, initial?.puertoDestinoId, initial?.tipoContenedorId]);

  const { data: tarifas = [], isFetching } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const isCN = (c: string | null | undefined) => c === "CN" || c === "China";
  const isMX = (c: string | null | undefined) => c === "MX" || c === "Mexico" || c === "México";
  const puertosCN = puertos.filter((p) => isCN(p.country));
  const puertosMX = puertos.filter((p) => isMX(p.country));
  const puertosOrigenList = puertosCN.length ? puertosCN : puertos;
  const puertosDestinoList = puertosMX.length ? puertosMX : puertos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar tarifa marítima (Top 3)</DialogTitle>
        <DialogDescription>Busca las tres mejores tarifas marítimas disponibles para la ruta seleccionada.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <Label>Puerto origen (CN)</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {puertosOrigenList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}, {p.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Puerto destino (MX)</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {puertosDestinoList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}, {p.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo contenedor</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <ResultadosBody
          origen={origen} destino={destino} tipo={tipo}
          isFetching={isFetching} tarifas={tarifas}
          onElegir={onElegir} onOpenChange={onOpenChange}
          selectLabel={selectLabel}
        />
      </DialogContent>
    </Dialog>
  );
}
