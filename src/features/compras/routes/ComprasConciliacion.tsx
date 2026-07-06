/**
 * /compras/conciliacion — Ola D. Conciliación factura ↔ embarque.
 *
 * Muestra el estatus de cobertura de facturación de proveedor sobre los
 * conceptos_costo de cada embarque activo. Permite filtrar por estado
 * (sin_facturar / parcial / completa), moneda y buscar por expediente/cliente.
 * Un click en una fila lleva al detalle del embarque para operar los conceptos.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GitCompare, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";

import {
  listarConciliacionEmbarques,
  type EmbarqueConciliacion,
  type EstadoConciliacion,
} from "@/features/compras/services/conciliacionEmbarques";

type EstadoFiltro = EstadoConciliacion | "todos";
type MonedaFiltro = "todas" | "MXN" | "USD";

const ESTADO_LABELS: Record<EstadoConciliacion, { label: string; variant: "outline" | "default" | "secondary" | "destructive"; icon: typeof Clock }> = {
  sin_facturar: { label: "Sin facturar", variant: "destructive", icon: AlertTriangle },
  parcial: { label: "Parcial", variant: "secondary", icon: Clock },
  completa: { label: "Conciliada", variant: "default", icon: CheckCircle2 },
};

export default function ComprasConciliacion() {
  const navigate = useNavigate();
  const orgId = useCurrentOrgId();
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [moneda, setMoneda] = useState<MonedaFiltro>("todas");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["compras", "conciliacion-embarques", { orgId, estado, moneda, search }],
    queryFn: () =>
      listarConciliacionEmbarques({
        organizationId: orgId,
        estado: estado === "todos" ? "todos" : estado,
        moneda: moneda === "todas" ? undefined : moneda,
        search: search.trim() || undefined,
      }),
    staleTime: 30_000,
  });

  const kpis = useMemo(() => {
    const sinFacturar = rows.filter((r) => r.estado_conciliacion === "sin_facturar").length;
    const parcial = rows.filter((r) => r.estado_conciliacion === "parcial").length;
    const completa = rows.filter((r) => r.estado_conciliacion === "completa").length;
    const pendienteMxn = rows
      .filter((r) => r.moneda === "MXN")
      .reduce((a, r) => a + r.pendiente, 0);
    const pendienteUsd = rows
      .filter((r) => r.moneda === "USD")
      .reduce((a, r) => a + r.pendiente, 0);
    return { sinFacturar, parcial, completa, pendienteMxn, pendienteUsd };
  }, [rows]);

  const columns = useMemo(
    () =>
      defineColumns<EmbarqueConciliacion>([
        {
          id: "expediente",
          header: "Expediente",
          accessorFn: (r) => r.expediente,
          cell: ({ row }) => (
            <span className="font-mono text-xs font-medium">{row.original.expediente}</span>
          ),
        },
        {
          id: "cliente",
          header: "Cliente",
          accessorFn: (r) => r.cliente_nombre ?? "—",
        },
        {
          id: "estado_embarque",
          header: "Estado",
          accessorFn: (r) => r.estado ?? "—",
          cell: ({ row }) =>
            row.original.estado ? (
              <Badge variant="outline" className="text-xs">{row.original.estado}</Badge>
            ) : "—",
        },
        {
          id: "presupuestado",
          header: "Presupuestado",
          accessorFn: (r) => r.presupuestado,
          cell: ({ row }) => formatCurrency(row.original.presupuestado, row.original.moneda),
        },
        {
          id: "pagado",
          header: "Facturado",
          accessorFn: (r) => r.pagado,
          cell: ({ row }) => formatCurrency(row.original.pagado, row.original.moneda),
        },
        {
          id: "pendiente",
          header: "Pendiente",
          accessorFn: (r) => r.pendiente,
          cell: ({ row }) => (
            <span className={row.original.pendiente > 0 ? "font-medium text-destructive" : ""}>
              {formatCurrency(row.original.pendiente, row.original.moneda)}
            </span>
          ),
        },
        {
          id: "cobertura",
          header: "Cobertura",
          accessorFn: (r) => r.cobertura,
          cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={Math.round(row.original.cobertura * 100)} className="h-1.5" />
              <span className="text-xs tabular-nums w-8 text-right">
                {Math.round(row.original.cobertura * 100)}%
              </span>
            </div>
          ),
        },
        {
          id: "conceptos_pendientes",
          header: "Pend.",
          accessorFn: (r) => r.conceptos_pendientes,
          cell: ({ row }) =>
            row.original.conceptos_pendientes > 0 ? (
              <Badge variant="outline" className="text-xs">
                {row.original.conceptos_pendientes}/{row.original.conceptos_total}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">0</span>
            ),
        },
        {
          id: "estado_conciliacion",
          header: "Conciliación",
          accessorFn: (r) => r.estado_conciliacion,
          cell: ({ row }) => {
            const meta = ESTADO_LABELS[row.original.estado_conciliacion];
            const Icon = meta.icon;
            return (
              <Badge variant={meta.variant} className="gap-1 text-xs">
                <Icon className="h-3 w-3" /> {meta.label}
              </Badge>
            );
          },
        },
      ]),
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        icon={GitCompare}
        title="Conciliación con embarques"
        description="Presupuesto (conceptos_costo) vs facturación real de proveedor por embarque."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Sin facturar" value={kpis.sinFacturar} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Parciales" value={kpis.parcial} icon={Clock} tone="warning" />
        <KpiCard label="Conciliadas" value={kpis.completa} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pendiente MXN" value={formatCurrency(kpis.pendienteMxn, "MXN")} />
        <KpiCard label="Pendiente USD" value={formatCurrency(kpis.pendienteUsd, "USD")} />
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Estado conciliación</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sin_facturar">Sin facturar</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="completa">Conciliadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaFiltro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Buscar</Label>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Expediente o cliente…"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay embarques con conceptos de costo para conciliar."
            onRowClick={(row) => navigate(`/embarques/${row.embarque_id}`)}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
