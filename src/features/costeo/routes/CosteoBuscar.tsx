/**
 * Página: buscador Top 3 de tarifas marítimas vigentes (consulta directa).
 * Oleada 4: migrado a PageContainer + LoadingState compartidos.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { PortIdSelect, TipoContenedorSelect } from "@/features/catalogos";

import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { usePuertosDeRutas } from "@/features/costeo/hooks/usePuertosDeRutas";
import { useDiagnosticoTarifas } from "@/features/costeo/hooks/useDiagnosticoTarifas";
import { CosteoBuscarFuentes } from "@/features/costeo/components/CosteoBuscarFuentes";
import { CosteoBuscarResultados } from "@/features/costeo/components/CosteoBuscarResultados";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { todayLocalISO } from "@/lib/date/today";

export default function CosteoBuscar() {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(todayLocalISO());
  const mismoPuerto = !!origen && origen === destino;
  const fuentes = usePuertosDeRutas(origen);
  const { origenes, destinos } = fuentes;

  // Un refresco puede retirar la ruta seleccionada: no consultar ni mostrar
  // resultados guardados para puertos que ya no son elegibles.
  const origenVigente = origenes.some((puerto) => puerto.id === origen) ? origen : "";
  const destinoVigente = destinos.some((puerto) => puerto.id === destino) ? destino : "";
  const rutaCompleta = !!origenVigente && !!destinoVigente && !mismoPuerto;
  const destinoConsulta = rutaCompleta ? destinoVigente : "";

  // Al cambiar origen, se elige de nuevo un destino de sus rutas activas.
  const elegirOrigen = (id: string) => {
    setOrigen(id);
    if (id !== origen) setDestino("");
  };

  const { data: tarifas = [], isFetching, isError, isSuccess, refetch, tipoContenedorIds } = useTopTarifas({
    puertoOrigenId: origenVigente,
    puertoDestinoId: destinoConsulta,
    tipoContenedorId: tipo,
    fecha,
  });

  const { diagnostico } = useDiagnosticoTarifas({
    puertoOrigenId: origenVigente,
    puertoDestinoId: destinoConsulta,
    tipoContenedorIds,
    // Sólo diagnosticar una búsqueda que TERMINÓ bien y vino vacía; un fallo
    // de red/RPC no es "no hay tarifas".
    enabled: rutaCompleta && !isFetching && !isError && isSuccess && tarifas.length === 0,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Buscar tarifa"
        description="Top 3 tarifas vigentes ordenadas por precio total, días de crédito y días libres de demoras."
      />

      <CosteoBuscarFuentes estado={fuentes} />
      <Card className="p-4" role="search" aria-label="Filtros de búsqueda de tarifa">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="buscar-origen">Puerto de origen</Label>
            <PortIdSelect
              id="buscar-origen"
              value={origenVigente}
              onChange={elegirOrigen}
              puertos={origenes}
              disabled={origenes.length === 0}
              placeholder="Buscar puerto de origen…"
            />
          </div>
          <div>
            <Label htmlFor="buscar-destino">Puerto de destino</Label>
            <PortIdSelect
              id="buscar-destino"
              value={destinoConsulta}
              onChange={setDestino}
              puertos={destinos}
              disabled={!origenVigente}
              excludeId={origenVigente}
              placeholder={origenVigente ? "Buscar puerto de destino…" : "Elige primero el origen"}
            />
          </div>

          <div>
            <Label htmlFor="buscar-tipo">Tipo contenedor</Label>
            <TipoContenedorSelect id="buscar-tipo" value={tipo} onChange={setTipo} />
          </div>
          <div>
            <Label htmlFor="buscar-fecha">Fecha</Label>
            <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
          </div>
        </div>
      </Card>

      <CosteoBuscarResultados
        mismoPuerto={mismoPuerto}
        seleccionCompleta={rutaCompleta && !!tipo}
        tarifas={tarifas}
        isFetching={isFetching}
        isError={isError}
        diagnostico={diagnostico}
        onRetry={() => void refetch()}
      />
    </PageContainer>
  );
}
