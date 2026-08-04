/**
 * Sección del diálogo "Capturar factura de proveedor": permite vincular la
 * factura a uno o varios conceptos_costo pendientes del proveedor seleccionado.
 *
 * Modelo de selección: por concepto (cada uno trae su embarque). Se agrupa
 * visualmente por expediente. Al marcar un concepto se pre-llena el monto
 * con el del concepto_costo; el usuario puede editarlo.
 */
import { useMemo, useState } from "react";
import { Loader2, Link2, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConceptosCostoAbiertos, type ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { SugerenciaVinculo } from "@/features/compras/matching/matcher";
import { SugerirEmbarqueBlock } from "./SugerirEmbarqueBlock";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { TopeVinculacionBar } from "./TopeVinculacionBar";
import type { ResultadoTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";


import { VincularFiltroToolbar } from "./VincularFiltroToolbar";
import { VincularListaConceptos } from "./VincularListaConceptos";
import {
  agruparPorEmbarque,
  calcularPuedeSugerir,
  ejecutarSugerencia,
  filtrarGrupos,
} from "./vincularEmbarqueHelpers";

import type { SeleccionLinea } from "@/features/cxp/types";


interface Props {
  proveedorId: string;
  proveedorNombre: string;
  organizationId: string | null;
  /** Map conceptoCostoId → {monto} (solo presentes los marcados). */
  seleccion: Record<string, SeleccionLinea>;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
  /** Aplica de golpe una lista de sugerencias del motor de matching. */
  onAplicarSugerencias?: (sugs: ReadonlyArray<{
    conceptoId: string; concepto: string; monto: number; embarque_id: string;
  }>) => void;
  facturaDescripcion?: string;
  facturaMonto?: number;
  facturaMoneda?: string;
  embarqueAdHoc: EmbarqueSeleccionado | null;
  onEmbarqueAdHoc: (sel: EmbarqueSeleccionado | null) => void;
  /** Tope: lo asignado no puede exceder el subtotal de la factura. */
  tope: ResultadoTopeVinculacion;
}


export function VincularEmbarqueSection({
  proveedorId, proveedorNombre, organizationId, seleccion, onToggle, onChangeMonto,
  onAplicarSugerencias, facturaDescripcion, facturaMonto, facturaMoneda,
  embarqueAdHoc, onEmbarqueAdHoc, tope,
}: Props) {
  const { data, isLoading } = useConceptosCostoAbiertos(proveedorId, organizationId);
  const grupos = useMemo(() => agruparPorEmbarque(data ?? []), [data]);
  const [ultimaSugerencia, setUltimaSugerencia] = useState<SugerenciaVinculo[] | null>(null);
  const [filtro, setFiltro] = useState<string>("");
  const [soloMarcados, setSoloMarcados] = useState<boolean>(false);

  const gruposFiltrados = useMemo(
    () => filtrarGrupos(grupos, { texto: filtro, soloMarcados, seleccion }),
    [grupos, filtro, soloMarcados, seleccion],
  );
  const totalConceptos = useMemo(
    () => grupos.reduce((n, g) => n + g.items.length, 0),
    [grupos],
  );
  const conceptosVisibles = useMemo(
    () => gruposFiltrados.reduce((n, g) => n + g.items.length, 0),
    [gruposFiltrados],
  );
  

  const puedeSugerir = calcularPuedeSugerir({
    onAplicar: onAplicarSugerencias,
    descripcion: facturaDescripcion,
    monto: facturaMonto,
    moneda: facturaMoneda,
    totalCandidatos: data?.length ?? 0,
  });

  const handleSugerir = () => {
    if (!onAplicarSugerencias || !data) return;
    ejecutarSugerencia({
      data,
      descripcion: facturaDescripcion ?? "",
      monto: facturaMonto ?? 0,
      moneda: facturaMoneda ?? "",
      onAplicar: onAplicarSugerencias,
      setUltima: setUltimaSugerencia,
    });
  };

  if (!proveedorId) return null;
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Buscando costos pendientes de este proveedor…
      </div>
    );
  }
  if (grupos.length === 0) {
    return (
      <SugerirEmbarqueBlock
        proveedorId={proveedorId}
        proveedorNombre={proveedorNombre}
        organizationId={organizationId}
        seleccionado={embarqueAdHoc}
        onSeleccionar={onEmbarqueAdHoc}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Link2 className="h-4 w-4 text-accent" />
        <Label className="text-sm font-semibold">Vincular a costos de embarque (opcional)</Label>
        <Badge variant="outline" className="ml-auto text-xs">
          {grupos.length} embarque{grupos.length === 1 ? "" : "s"} con costos pendientes
        </Badge>
        {puedeSugerir && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleSugerir}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Sugerir vinculación
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Marca los conceptos que cubre esta factura, o usa <strong>Sugerir vinculación</strong>{" "}
        para que el sistema los preseleccione por similitud de descripción y monto. Los
        conceptos cubiertos al 100% se marcarán como liquidados automáticamente.
      </p>
      {ultimaSugerencia && ultimaSugerencia.length > 0 && (
        <div className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
          Última sugerencia: {ultimaSugerencia.length} concepto
          {ultimaSugerencia.length === 1 ? "" : "s"} preseleccionado
          {ultimaSugerencia.length === 1 ? "" : "s"}. Ajusta lo que no cuadre antes de guardar.
        </div>
      )}

      <VincularFiltroToolbar
        filtro={filtro}
        onFiltro={setFiltro}
        soloMarcados={soloMarcados}
        onSoloMarcados={setSoloMarcados}
        visibles={conceptosVisibles}
        total={totalConceptos}
      />

      <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border p-2 bg-background">
        <VincularListaConceptos
          grupos={gruposFiltrados}
          seleccion={seleccion}
          onToggle={onToggle}
          onChangeMonto={onChangeMonto}
        />
      </div>
    </div>
  );
}
