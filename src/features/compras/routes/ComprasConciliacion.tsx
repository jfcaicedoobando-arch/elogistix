/**
 * /compras/conciliacion — Ola D. Conciliación factura ↔ embarque.
 *
 * Muestra el estatus de cobertura de facturación de proveedor sobre los
 * conceptos_costo de cada embarque activo. Permite filtrar por estado
 * (sin_facturar / parcial / completa), moneda y buscar por expediente/cliente.
 * Un click en una fila lleva al detalle del embarque para operar los conceptos.
 */
import { useMemo, useState } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import { GitCompare, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";

import {
  listarConciliacionEmbarques,
  type EstadoConciliacion,
} from "@/features/compras/services/conciliacionEmbarques";
import { buildConciliacionColumns } from "./_sections/conciliacionColumns";
import { ConciliacionDetalleSheet } from "./_sections/ConciliacionDetalleSheet";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import { ErrorState } from "@/components/shared/states/ErrorState";

const ESTADOS_FILTRO = ["todos", "sin_facturar", "parcial", "completa"] as const;
type EstadoFiltro = (typeof ESTADOS_FILTRO)[number] & (EstadoConciliacion | "todos");
const MONEDAS_FILTRO = ["todas", "MXN", "USD", "EUR"] as const;
type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];

export default function ComprasConciliacion() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [estado, setEstado] = useFiltroUrl<EstadoFiltro>("estado", ESTADOS_FILTRO, "todos");
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [search, setSearch] = useTextoUrl("q");
  const [detalle, setDetalle] = useState<EmbarqueConciliacion | null>(null);
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: [...compras.conciliacionEmbarques({ estado, moneda, search }), organizationId],
    queryFn: () =>
      listarConciliacionEmbarques({
        estado: estado === "todos" ? "todos" : estado,
        moneda: moneda === "todas" ? undefined : moneda,
        search: search.trim() || undefined,
        organizationId,
      }),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
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
    const pendienteEur = rows
      .filter((r) => r.moneda === "EUR")
      .reduce((a, r) => a + r.pendiente, 0);
    return { sinFacturar, parcial, completa, pendienteMxn, pendienteUsd, pendienteEur };
  }, [rows]);

  const columns = useMemo(() => buildConciliacionColumns(), []);


  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<GitCompare className="h-6 w-6" />}
        title="Conciliación con embarques"
        description="Presupuesto (conceptos de costo) vs facturación real de proveedor por embarque."
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Sin facturar" value={kpis.sinFacturar} icon={AlertTriangle} variant="destructive" />
        <KpiCard label="Parciales" value={kpis.parcial} icon={Clock} variant="warning" />
        <KpiCard label="Conciliadas" value={kpis.completa} icon={CheckCircle2} variant="success" />
        <KpiCard label="Pendiente MXN" value={formatCurrency(kpis.pendienteMxn, "MXN")} />
        <KpiCard label="Pendiente USD" value={formatCurrency(kpis.pendienteUsd, "USD")} />
        <KpiCard label="Pendiente EUR" value={formatCurrency(kpis.pendienteEur, "EUR")} />

      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Estado conciliación</Label>
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
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaFiltro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Buscar</Label>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Expediente o cliente…"
              />
            </div>
          </div>

          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay embarques con conceptos de costo para conciliar."
            rowKey={(r) => `${r.embarque_id}-${r.moneda}`}
            onRowClick={(row) => setDetalle(row)}
            stickyHeader
          />
          )}
        </CardContent>
      </Card>

      <ConciliacionDetalleSheet embarque={detalle} onClose={() => setDetalle(null)} />
    </PageContainer>
  );
}
