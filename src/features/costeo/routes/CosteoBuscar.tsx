/**
 * Página: buscador Top 3 de tarifas marítimas vigentes (consulta directa).
 * Oleada 4: migrado a PageContainer + LoadingState compartidos.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { useDiagnosticoTarifas } from "@/features/costeo/hooks/useDiagnosticoTarifas";
import { TarifasSinResultado } from "@/features/costeo/components/TarifasSinResultado";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import { computeRankingMeta } from "@/features/costeo/utils/rankingLabels";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { MapPinned } from "lucide-react";
import { todayLocalISO } from "@/lib/date/today";

export default function CosteoBuscar() {
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(todayLocalISO());

  const { data: tarifas = [], isFetching, tipoContenedorIds } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const { diagnostico } = useDiagnosticoTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: destino,
    tipoContenedorIds,
    enabled: !isFetching && tarifas.length === 0,
  });

  const puertosCN = puertos.filter(
    (p) => p.country === "CN" || p.country === "China",
  );
  const puertosMX = puertos.filter(
    (p) =>
      p.country === "MX" ||
      p.country === "Mexico" ||
      p.country === "México",
  );

  return (
    <PageContainer>
      <PageHeader
        title="Buscar tarifa"
        description="Top 3 tarifas vigentes ordenadas por precio total, días de crédito y días libres de demoras."
      />

      <Card className="p-4" role="search" aria-label="Filtros de búsqueda de tarifa">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="buscar-origen">Puerto origen (CN)</Label>
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger id="buscar-origen">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {(puertosCN.length ? puertosCN : puertos).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}, {p.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="buscar-destino">Puerto destino (MX)</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger id="buscar-destino">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {(puertosMX.length ? puertosMX : puertos).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}, {p.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="buscar-tipo">Tipo contenedor</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="buscar-tipo">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="buscar-fecha">Fecha</Label>
            <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
          </div>
        </div>
      </Card>

      {!origen || !destino || !tipo ? (
        <Card>
          <EmptyStateInline
            icon={MapPinned}
            message="Selecciona ruta y tipo de contenedor para ver las tarifas vigentes."
          />
        </Card>
      ) : isFetching ? (
        <Card>
          <LoadingState label="Buscando tarifas…" />
        </Card>
      ) : tarifas.length === 0 ? (
        <Card>
          <TarifasSinResultado diagnostico={diagnostico} />
        </Card>
      ) : (
        (() => {
          const meta = computeRankingMeta(tarifas);
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tarifas.map((t, i) => (
                <TarifaResultCard key={t.id} row={t} rank={i + 1} meta={meta[i]} />
              ))}
            </div>
          );
        })()
      )}
    </PageContainer>
  );
}
