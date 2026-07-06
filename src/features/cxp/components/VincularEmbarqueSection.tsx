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
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { useConceptosCostoAbiertos, type ConceptoCostoAbierto } from "@/features/cxp/hooks";
import { sugerirVinculos, type SugerenciaVinculo } from "@/features/compras/matching/matcher";
import { SugerirEmbarqueBlock, type EmbarqueSeleccionado } from "./SugerirEmbarqueBlock";

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

interface Grupo {
  expediente: string;
  embarqueId: string;
  items: ConceptoCostoAbierto[];
}

function agruparPorEmbarque(items: ConceptoCostoAbierto[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const it of items) {
    const key = it.embarque_id;
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, {
      embarqueId: key,
      expediente: it.embarque_expediente ?? key.slice(0, 8),
      items: [it],
    });
  }
  return Array.from(map.values());
}

function pluralS(n: number, base: string): string {
  return `${n} ${base}${n === 1 ? "" : "s"}`;
}

function notificarResumen(
  res: { seleccion: SugerenciaVinculo[]; descartadosPorMoneda: number },
  totalCandidatos: number,
) {
  if (res.seleccion.length === 0) {
    toast.info("Sin sugerencias con confianza suficiente. Marca manualmente los conceptos.");
    return;
  }
  const fuertes = res.seleccion.filter((s) => s.fuerte).length;
  const dudosas = res.seleccion.length - fuertes;
  const sinMatch = totalCandidatos - res.seleccion.length - res.descartadosPorMoneda;
  const partes: string[] = [`${pluralS(res.seleccion.length, "sugerencia")} aplicada${res.seleccion.length === 1 ? "" : "s"}`];
  if (dudosas > 0) partes.push(pluralS(dudosas, "dudosa"));
  if (res.descartadosPorMoneda > 0) partes.push(`${pluralS(res.descartadosPorMoneda, "descartada")} por moneda`);
  if (sinMatch > 0) partes.push(`${sinMatch} sin match`);
  toast.success(partes.join(" · "));
}

function calcularPuedeSugerir(args: {
  onAplicar: unknown;
  descripcion?: string;
  monto?: number;
  moneda?: string;
  totalCandidatos: number;
}): boolean {
  const { onAplicar, descripcion, monto, moneda, totalCandidatos } = args;
  return !!onAplicar && !!descripcion && !!moneda && (monto ?? 0) > 0 && totalCandidatos > 0;
}

function ejecutarSugerencia(args: {
  data: ConceptoCostoAbierto[];
  descripcion: string;
  monto: number;
  moneda: string;
  onAplicar: (sugs: ReadonlyArray<{ conceptoId: string; concepto: string; monto: number; embarque_id: string }>) => void;
  setUltima: (s: SugerenciaVinculo[]) => void;
}) {
  const res = sugerirVinculos(
    { descripcion: args.descripcion, monto: args.monto, moneda: args.moneda },
    args.data.map((c) => ({
      id: c.id, concepto: c.concepto, monto: c.monto, moneda: c.moneda, embarque_id: c.embarque_id,
    })),
  );
  args.setUltima(res.seleccion);
  args.onAplicar(
    res.seleccion.map((s) => ({
      conceptoId: s.conceptoId, concepto: s.concepto, monto: s.monto, embarque_id: s.embarque_id,
    })),
  );
  notificarResumen(res, args.data.length);
}

export function VincularEmbarqueSection({
  proveedorId, proveedorNombre, organizationId, seleccion, onToggle, onChangeMonto,
  onAplicarSugerencias, facturaDescripcion, facturaMonto, facturaMoneda,
  embarqueAdHoc, onEmbarqueAdHoc,
}: Props) {
  const { data, isLoading } = useConceptosCostoAbiertos(proveedorId, organizationId);
  const grupos = useMemo(() => agruparPorEmbarque(data ?? []), [data]);
  const [ultimaSugerencia, setUltimaSugerencia] = useState<SugerenciaVinculo[] | null>(null);

  const puedeSugerir =
    !!onAplicarSugerencias &&
    !!facturaDescripcion &&
    !!facturaMoneda &&
    (facturaMonto ?? 0) > 0 &&
    (data?.length ?? 0) > 0;

  const handleSugerir = () => {
    if (!onAplicarSugerencias || !data) return;
    const res = sugerirVinculos(
      {
        descripcion: facturaDescripcion ?? "",
        monto: facturaMonto ?? 0,
        moneda: facturaMoneda ?? "",
      },
      data.map((c) => ({
        id: c.id,
        concepto: c.concepto,
        monto: c.monto,
        moneda: c.moneda,
        embarque_id: c.embarque_id,
      })),
    );
    setUltimaSugerencia(res.seleccion);
    onAplicarSugerencias(
      res.seleccion.map((s) => ({
        conceptoId: s.conceptoId,
        concepto: s.concepto,
        monto: s.monto,
        embarque_id: s.embarque_id,
      })),
    );
    notificarResumen(res, data.length);
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
      <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border p-2 bg-background">
        {grupos.map((g) => (
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
