/**
 * Dialog reutilizable para buscar Top 3 tarifas marítimas y opcionalmente
 * devolver la elegida al caller (usado en /costeo/buscar y en wizard cotización).
 * Etapa 1 rutas globales: acepta cualquier par de puertos del catálogo.
 */
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { PortIdSelect, TipoContenedorSelect } from "@/features/catalogos";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { useDiagnosticoTarifas } from "@/features/costeo/hooks/useDiagnosticoTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";
import { ResultadosBody } from "./BuscarTarifaDialog.ResultadosBody";
import { useFiltrosTarifa, type FiltrosTarifaInitial } from "./BuscarTarifaDialog.helpers";

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
  const { origen, setOrigen, destino, setDestino, tipo, setTipo, fecha, setFecha, mismoPuerto } =
    useFiltrosTarifa(open, initial);

  const {
    data: tarifas = [], isFetching, error, refetch, isRefetching,
    tipoContenedorIds = [],
  } = useTopTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: mismoPuerto ? "" : destino,
    tipoContenedorId: tipo,
    fecha,
  });

  const { diagnostico } = useDiagnosticoTarifas({
    puertoOrigenId: origen,
    puertoDestinoId: mismoPuerto ? "" : destino,
    tipoContenedorIds,
    enabled: !mismoPuerto && !isFetching && !error && tarifas.length === 0,
  });

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
          <Label htmlFor="td-origen">Puerto de origen</Label>
          <PortIdSelect
            id="td-origen"
            value={origen}
            onChange={setOrigen}
            placeholder="Buscar puerto de origen…"
          />
        </div>
        <div>
          <Label htmlFor="td-destino">Puerto de destino</Label>
          <PortIdSelect
            id="td-destino"
            value={destino}
            onChange={setDestino}
            excludeId={origen}
            placeholder="Buscar puerto de destino…"
          />
        </div>
        <div>
          <Label htmlFor="td-tipo">Tipo contenedor</Label>
          <TipoContenedorSelect id="td-tipo" value={tipo} onChange={setTipo} />
        </div>
        <div>
          <Label htmlFor="td-fecha">Fecha</Label>
          <DatePickerMx value={fecha} onChange={setFecha} className="w-full" />
        </div>
      </div>

      {mismoPuerto ? (
        <p className="text-body text-destructive" role="alert">
          El puerto de origen y el de destino deben ser distintos.
        </p>
      ) : (
        <ResultadosBody
          origen={origen} destino={destino} tipo={tipo}
          isFetching={isFetching} tarifas={tarifas}
          error={error} onRetry={() => void refetch()} isRefetching={isRefetching}
          onElegir={onElegir} onOpenChange={onOpenChange}
          selectLabel={selectLabel}
          diagnostico={diagnostico}
        />
      )}
    </FormDialogShell>
  );
}
