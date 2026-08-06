import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import type { ConceptoCostoRow } from "@/features/embarques/hooks";
import { GrupoCostosProveedor } from "./GrupoCostosProveedor";
import { ResumenAjusteBar } from "./ResumenAjusteBar";

const FOCUS_LABEL: Record<string, string> = {
  cxp: "facturas de proveedor por pagar",
  "costo-no-liquidado": "costos pendientes de liquidación",
  "costo-sin-factura": "costos sin factura de proveedor",
};
const FOCUS_KEYS = ["cxp", "costo-no-liquidado", "costo-sin-factura"];

interface Props {
  filas: FilaReconciliacion[];
  /** Costos crudos para resolver contenedor_id, estado_liquidacion base, etc. */
  conceptosCosto: ConceptoCostoRow[];
  showContenedorCol?: boolean;
  renderContenedor?: (id: string | null | undefined) => React.ReactNode;
  irACargarCostos?: { label: string; onClick: () => void };
}

export function ConceptosCostoCard({
  filas,
  conceptosCosto,
  showContenedorCol,
  renderContenedor,
  irACargarCostos,
}: Props) {
  const { focus, registerRef, clearFocus } = useFocusSection();
  const costoFocus = focus && FOCUS_KEYS.includes(focus) ? focus : null;

  // Mapa id → concepto crudo, para resolver contenedor_id.
  const rawById = useMemo(() => {
    const m = new Map<string, ConceptoCostoRow>();
    for (const c of conceptosCosto) m.set(c.id, c);
    return m;
  }, [conceptosCosto]);

  const filaContenedorId = (f: FilaReconciliacion) => rawById.get(f.concepto_costo_id)?.contenedor_id ?? null;

  const filasFiltradas = useMemo(() => {
    if (!costoFocus) return filas;
    if (costoFocus === "costo-sin-factura") {
      return filas.filter(f => f.facturas.length === 0);
    }
    // cxp / costo-no-liquidado: excluir conceptos ya pagados
    return filas.filter(f => (f.estado_liquidacion ?? "").toLowerCase() !== "pagado");
  }, [filas, costoFocus]);

  // Agrupación por proveedor, ordenada alfabéticamente.
  const grupos = useMemo(() => {
    const map = new Map<string, FilaReconciliacion[]>();
    for (const f of filasFiltradas) {
      const key = f.proveedor_nombre || "Sin proveedor";
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([nombre, filas]) => ({ nombre, filas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [filasFiltradas]);

  // Totales globales por moneda. B-057: además de cotizado/facturado
  // guardamos `cotizadoFacturable` (sólo filas con factura) para que el
  // % de "Ahorro/Sobrecosto" no se infle con costos por devengar.
  const totales = useMemo(() => {
    const map = new Map<string, { moneda: string; cotizado: number; facturado: number; cotizadoFacturable: number; sinFactura: number }>();
    for (const f of filasFiltradas) {
      const cur = map.get(f.moneda) ?? { moneda: f.moneda, cotizado: 0, facturado: 0, cotizadoFacturable: 0, sinFactura: 0 };
      cur.cotizado += f.cotizado;
      cur.facturado += f.real_facturado;
      if (f.facturas.length > 0) cur.cotizadoFacturable += f.cotizado;
      else cur.sinFactura += 1;
      map.set(f.moneda, cur);
    }
    return Array.from(map.values());
  }, [filasFiltradas]);

  const emptyTitle = costoFocus ? "Sin coincidencias con el filtro" : "Sin costos directos del embarque";
  const emptyDescription = costoFocus
    ? "El filtro del checklist no encuentra costos pendientes; verifica si ya fueron atendidos."
    : (irACargarCostos
        ? "Haz clic en el ícono o en el botón para capturar los costos del embarque."
        : "Aún no se han registrado costos directos para este embarque.");

  return (
    <Card ref={registerRef(costoFocus ?? "")} data-focus={costoFocus ?? undefined}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle >Costos directos del embarque</CardTitle>
        {costoFocus && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="border-primary text-primary">
              Filtrando: {FOCUS_LABEL[costoFocus]}
            </Badge>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearFocus}>
              <X className="mr-1 h-3 w-3" /> Limpiar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {grupos.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title={emptyTitle}
              description={emptyDescription}
              primaryAction={costoFocus ? undefined : irACargarCostos}
            />
          </div>
        ) : (
          <>
            {totales.length > 0 && <ResumenAjusteBar totales={totales} />}

            {grupos.map(g => (
              <GrupoCostosProveedor
                key={g.nombre}
                proveedorNombre={g.nombre}
                filas={g.filas}
                showContenedorCol={showContenedorCol}
                renderContenedor={renderContenedor}
                filaContenedorId={filaContenedorId}
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
