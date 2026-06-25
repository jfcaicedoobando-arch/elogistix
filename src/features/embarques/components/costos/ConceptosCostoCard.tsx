import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import type { ConceptoCostoRow } from "@/features/embarques/hooks";

const FOCUS_LABEL: Record<string, string> = {
  cxp: "facturas de proveedor por pagar",
  "costo-no-liquidado": "costos pendientes de liquidación",
  "costo-sin-factura": "costos sin factura de proveedor",
};
const FOCUS_KEYS = ["cxp", "costo-no-liquidado", "costo-sin-factura"];

interface Props {
  conceptosCosto: ConceptoCostoRow[];
  columns: ColumnDef<ConceptoCostoRow, unknown>[];
  /** IDs de conceptos_costo que ya tienen factura de proveedor vinculada. */
  costosConFactura?: ReadonlySet<string>;
  irACargarCostos?: { label: string; onClick: () => void };
}

export function ConceptosCostoCard({ conceptosCosto, columns, costosConFactura, irACargarCostos }: Props) {
  const { focus, registerRef, clearFocus } = useFocusSection();
  const costoFocus = focus && FOCUS_KEYS.includes(focus) ? focus : null;

  const conceptosFiltrados = useMemo(() => {
    if (costoFocus === "cxp" || costoFocus === "costo-no-liquidado") {
      return conceptosCosto.filter(c => (c.estado_liquidacion ?? '').toLowerCase() !== 'pagado');
    }
    if (costoFocus === "costo-sin-factura" && costosConFactura) {
      return conceptosCosto.filter(c =>
        (c.estado_liquidacion ?? '').toLowerCase() !== 'pagado' && !costosConFactura.has(c.id),
      );
    }
    return conceptosCosto;
  }, [conceptosCosto, costoFocus, costosConFactura]);

  const emptyTitle = costoFocus ? "Sin coincidencias con el filtro" : "Sin costos directos del embarque";
  const emptyDescription = costoFocus
    ? "El filtro del checklist no encuentra costos pendientes; verifica si ya fueron atendidos."
    : (irACargarCostos
        ? "Haz clic en el ícono o en el botón para capturar los costos del embarque."
        : "Aún no se han registrado costos directos para este embarque.");

  return (
    <Card ref={registerRef(costoFocus ?? "")} data-focus={costoFocus ?? undefined}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Costos directos del embarque</CardTitle>
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
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={conceptosFiltrados}
          rowKey={(c) => c.id}
          density="compact"
          emptyState={
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title={emptyTitle}
                description={emptyDescription}
                primaryAction={costoFocus ? undefined : irACargarCostos}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
