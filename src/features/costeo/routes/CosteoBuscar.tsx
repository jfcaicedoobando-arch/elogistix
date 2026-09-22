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
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { PortIdSelect } from "@/features/catalogos";

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
  const { data: tipos = [] } = useTiposContenedor();
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(todayLocalISO());
  const mismoPuerto = !!origen && origen === destino;

  // Origen y destino deben diferir; si coinciden no disparamos la búsqueda.
  const elegirOrigen = (id: string) => {
    setOrigen(id);
    if (id && id === destino) setDestino("");
  };

  const { data: tarifas = [], isFetching, tipoContenedorIds } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: mismoPuerto ? "" : destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const { diagnostico } = useDiagnosticoTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: mismoPuerto ? "" : destino,
    tipoContenedorIds,
    enabled: !mismoPuerto && !isFetching && tarifas.length === 0,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Buscar tarifa"
        description="Top 3 tarifas vigentes ordenadas por precio total, días de crédito y días libres de demoras."
      />

      <Card className="p-4" role="search" aria-label="Filtros de búsqueda de tarifa">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="buscar-origen">Puerto de origen</Label>
            <PortIdSelect
              id="buscar-origen"
              value={origen}
              onChange={elegirOrigen}
              placeholder="Buscar puerto de origen…"
            />
          </div>
          <div>
            <Label htmlFor="buscar-destino">Puerto de destino</Label>
            <PortIdSelect
              id="buscar-destino"
              value={destino}
              onChange={setDestino}
              excludeId={origen}
              placeholder="Buscar puerto de destino…"
            />
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

      {mismoPuerto ? (
        <Card className="p-4">
          <p className="text-body text-destructive" role="alert">
            El puerto de origen y el de destino deben ser distintos.
          </p>
        </Card>
      ) : !origen || !destino || !tipo ? (
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
