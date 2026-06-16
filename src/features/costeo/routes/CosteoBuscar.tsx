/**
 * Página: buscador Top 3 de tarifas marítimas vigentes (consulta directa).
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import { PageHeader } from "@/components/shared/PageHeader";

export default function CosteoBuscar() {
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const { data: tarifas = [], isFetching } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const puertosCN = puertos.filter((p) => p.country === "CN" || p.country === "China");
  const puertosMX = puertos.filter((p) => p.country === "MX" || p.country === "Mexico" || p.country === "México");

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Buscar tarifa"
        description="Top 3 tarifas vigentes ordenadas por precio total, días de crédito y días libres de demoras."
      />

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>Puerto origen (CN)</Label>
          <Select value={origen} onValueChange={setOrigen}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {(puertosCN.length ? puertosCN : puertos).map((p) => (
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
              {(puertosMX.length ? puertosMX : puertos).map((p) => (
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
      </Card>

      {!origen || !destino || !tipo ? (
        <Card className="p-8 text-center text-muted-foreground">
          Selecciona ruta y tipo de contenedor para ver las tarifas vigentes.
        </Card>
      ) : isFetching ? (
        <Card className="p-8 text-center text-muted-foreground">Buscando…</Card>
      ) : tarifas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No hay tarifas vigentes para esta combinación. Captura una nueva en "Tarifas marítimas".
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tarifas.map((t, i) => (
            <TarifaResultCard key={t.id} row={t} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
