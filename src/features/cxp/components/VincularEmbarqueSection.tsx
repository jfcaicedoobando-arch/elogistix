/**
 * Sección del diálogo "Capturar factura de proveedor": permite vincular la
 * factura a uno o varios conceptos_costo pendientes del proveedor seleccionado.
 *
 * Modelo de selección: por concepto (cada uno trae su embarque). Se agrupa
 * visualmente por expediente. Al marcar un concepto se pre-llena el monto
 * con el del concepto_costo; el usuario puede editarlo.
 */
import { useMemo, useState } from "react";
import { Loader2, Link2, Sparkles, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { useConceptosCostoAbiertos, type ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { SugerenciaVinculo } from "@/features/compras/matching/matcher";
import { SugerirEmbarqueBlock, type EmbarqueSeleccionado } from "./SugerirEmbarqueBlock";
import {
  agruparPorEmbarque,
  calcularPuedeSugerir,
  ejecutarSugerencia,
  filtrarGrupos,
} from "./vincularEmbarqueHelpers";

export interface SeleccionLinea {
  monto: number;
}

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
}

export function VincularEmbarqueSection({
  proveedorId, proveedorNombre, organizationId, seleccion, onToggle, onChangeMonto,
  onAplicarSugerencias, facturaDescripcion, facturaMonto, facturaMoneda,
  embarqueAdHoc, onEmbarqueAdHoc,
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
  const filtroActivo = filtro.trim().length > 0 || soloMarcados;

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

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por concepto, expediente o monto…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant={soloMarcados ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setSoloMarcados((v) => !v)}
        >
          Sólo marcados
        </Button>
        {filtroActivo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => { setFiltro(""); setSoloMarcados(false); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>
      {filtroActivo && (
        <p className="text-xs text-muted-foreground">
          Mostrando {conceptosVisibles} de {totalConceptos} concepto{totalConceptos === 1 ? "" : "s"}
        </p>
      )}

      <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border p-2 bg-background">
        {gruposFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-3 py-4 text-center">
            Ningún concepto coincide con el filtro.
          </p>
        ) : gruposFiltrados.map((g) => (
          <div key={g.embarqueId} className="rounded-md border bg-muted/20">
            <div className="px-3 py-1.5 border-b bg-muted/40 text-xs font-medium">
              Embarque <span className="font-mono">{g.expediente}</span>
            </div>
            <div className="divide-y">
              {g.items.map((it) => {
                const sel = seleccion[it.id];
                const checked = !!sel;
                return (
                  <div key={it.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => onToggle(it, !!v)}
                      aria-label={`Vincular ${it.concepto}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" title={it.concepto}>{it.concepto}</div>
                      <div className="text-xs text-muted-foreground">
                        Cotizado: {formatCurrency(it.monto, it.moneda)}
                      </div>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{it.moneda}</span>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={sel.monto}
                          onChange={(e) => onChangeMonto(it.id, Number(e.target.value) || 0)}
                          className="w-28 h-8 text-right tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
