import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Receipt, X } from "lucide-react";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import EmptyState from "@/components/empty/EmptyState";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useContenedoresEmbarque } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { SeccionDemorasAuto } from "@/features/embarques/components/financiero/SeccionDemorasAuto";
import type { ConceptoVentaRow, ConceptoCostoRow } from "@/features/embarques/hooks";

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
  embarqueId?: string;
  canEdit?: boolean;
}

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

export function TabCostos({ conceptosVenta, conceptosCosto, totalVenta, totalCosto, utilidad, margen, embarqueId, canEdit }: Props) {
  const navigate = useNavigate();
  const { data: contenedores = [] } = useContenedoresEmbarque(embarqueId ?? '');
  const { focus, registerRef, clearFocus } = useFocusSection();

  // Foco soportado en este tab: filtra la tabla de costos según el motivo del cierre.
  // - "cxp" / "costo-no-liquidado" → estado_liquidacion = "Pendiente".
  // - "costo-sin-factura" → no podemos verificar facturas client-side; sólo resaltamos la sección.
  const costoFocus = focus && ["cxp", "costo-no-liquidado", "costo-sin-factura"].includes(focus)
    ? focus
    : null;
  const conceptosCostoFiltrados = useMemo(() => {
    if (costoFocus === "cxp" || costoFocus === "costo-no-liquidado") {
      return conceptosCosto.filter(c => (c.estado_liquidacion ?? '').toLowerCase() !== 'pagado');
    }
    return conceptosCosto;
  }, [conceptosCosto, costoFocus]);
  const focusLabel: Record<string, string> = {
    cxp: "facturas de proveedor por pagar",
    "costo-no-liquidado": "costos pendientes de liquidación",
    "costo-sin-factura": "costos sin factura de proveedor",
  };
  const showContenedorCol = contenedores.length >= 2;
  const contenedorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    contenedores.forEach(c => map.set(c.id, c.numero_contenedor || `Contenedor ${c.orden}`));
    return map;
  }, [contenedores]);

  const renderContenedor = (id: string | null | undefined) =>
    id ? (contenedorLabelById.get(id) ?? 'General') : <span className="text-muted-foreground">General</span>;

  const ventaColumns = useMemo<ColumnDef<ConceptoVentaRow, unknown>[]>(() => {
    const base: ColumnDef<ConceptoVentaRow, unknown>[] = [
      { id: "concepto", header: "Concepto", cell: ({ row }) => row.original.descripcion },
      { id: "cant", header: "Cant.", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => row.original.cantidad },
      { id: "pu", header: "P. Unitario", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda) },
      { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
    ];
    if (showContenedorCol) {
      base.push({ id: "contenedor", header: "Contenedor", cell: ({ row }) => renderContenedor(row.original.contenedor_id) });
    }
    base.push({ id: "total", header: "Total", meta: { align: "right", className: "font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.total), row.original.moneda) });
    return defineColumns<ConceptoVentaRow>(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContenedorCol, contenedorLabelById]);

  const costoColumns = useMemo<ColumnDef<ConceptoCostoRow, unknown>[]>(() => {
    const base: ColumnDef<ConceptoCostoRow, unknown>[] = [
      { id: "proveedor", header: "Proveedor", cell: ({ row }) => <span title={row.original.proveedor_nombre}>{toTitleCase(row.original.proveedor_nombre)}</span> },
      { id: "concepto", header: "Concepto", cell: ({ row }) => row.original.concepto },
      { id: "monto", header: "Monto", meta: { align: "right", className: "font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.monto), row.original.moneda) },
      { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
    ];
    if (showContenedorCol) {
      base.push({ id: "contenedor", header: "Contenedor", cell: ({ row }) => renderContenedor(row.original.contenedor_id) });
    }
    base.push({ id: "liq", header: "Liquidación", cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado_liquidacion)}>{row.original.estado_liquidacion}</Badge> });
    return defineColumns<ConceptoCostoRow>(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContenedorCol, contenedorLabelById]);

  const kpis = [
    { label: 'Total Venta', value: formatCurrency(totalVenta), color: '' },
    { label: 'Total Costo', value: formatCurrency(totalCosto), color: '' },
    { label: 'Utilidad', value: formatCurrency(utilidad), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const irACargarCostos = canEdit && embarqueId
    ? { label: "Cargar costos", onClick: () => navigate(`/embarques/${embarqueId}/editar?step=3`) }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className={kpiColors[i]}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {embarqueId && <SeccionDemorasAuto embarqueId={embarqueId} canEdit={!!canEdit} />}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={ventaColumns}
            data={conceptosVenta}
            rowKey={(c) => c.id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="Sin conceptos de venta"
                  description={irACargarCostos ? "Haz clic en el ícono o en el botón para capturar los conceptos de venta." : "Aún no se han registrado conceptos de venta para este embarque."}
                  primaryAction={irACargarCostos}
                />
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card ref={registerRef(costoFocus ?? "")} data-focus={costoFocus ?? undefined}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Conceptos de Costo</CardTitle>
          {costoFocus && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="border-primary text-primary">
                Filtrando: {focusLabel[costoFocus]}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={clearFocus}
              >
                <X className="mr-1 h-3 w-3" /> Limpiar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={costoColumns}
            data={conceptosCostoFiltrados}
            rowKey={(c) => c.id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title={costoFocus ? "Sin coincidencias con el filtro" : "Sin conceptos de costo"}
                  description={costoFocus ? "El filtro del checklist no encuentra costos pendientes; verifica si ya fueron atendidos." : (irACargarCostos ? "Haz clic en el ícono o en el botón para capturar los costos del embarque." : "Aún no se han registrado conceptos de costo para este embarque.")}
                  primaryAction={costoFocus ? undefined : irACargarCostos}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
