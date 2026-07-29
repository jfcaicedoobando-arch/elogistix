import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, Ship, Coins, FileStack } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type SortDir } from "@/components/shared/DataTable";


import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { useCxpPorCapturarFilters, type OrdenarPor } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";
import { resumirCxpPorCapturar } from "@/features/bandejas/domain/aggregates";
import { CxpPorCapturarToolbar } from "@/features/bandejas/components/CxpPorCapturarToolbar";
import { buildCxpPorCapturarColumns } from "@/features/bandejas/components/cxpPorCapturarColumns";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { usePermissions } from "@/hooks/shared/usePermissions";

// Mapeo entre ColumnDef.id de DataTable y los OrdenarPor del hook de filtros.
const COL_TO_SORT: Record<string, OrdenarPor> = {
  expediente: "expediente",
  facturas: "facturas",
  ultima: "antiguedad",
};
const SORT_TO_COL: Record<OrdenarPor, string> = {
  expediente: "expediente",
  facturas: "facturas",
  antiguedad: "ultima",
  monto: "", // No mapeado a columna; se ordena desde toolbar.
};

export default function CxpPorCapturar() {
  const { canCapturarFacturaProveedor } = usePermissions();
  const { data = [], isLoading, isError, refetch } = useCxpPorCapturar();
  const { totalPresupuestadoMxn, totalPresupuestadoUsd, facturasCapturadas } = resumirCxpPorCapturar(data);
  const filters = useCxpPorCapturarFilters(data);
  const [picked, setPicked] = useState<EmbarqueSeleccionado | null>(null);

  const handleCapturar = (row: RowData) => {
    setPicked({
      embarqueId: row.embarque_id,
      expediente: row.expediente ?? row.embarque_id.slice(0, 8),
      concepto: "Servicios proveedor",
    });
  };

  const hideEstatus = filters.state.estatus === "sin";
  const columns = useMemo(
    () => buildCxpPorCapturarColumns({
      onCapturar: canCapturarFacturaProveedor ? handleCapturar : undefined,
      hideEstatus,
    }),
    [hideEstatus, canCapturarFacturaProveedor],
  );

  const controlledSort = {
    key: SORT_TO_COL[filters.state.ordenarPor] || null,
    dir: filters.state.direccion as SortDir,
  };

  const handleSortChange = (key: string | null, dir: SortDir) => {
    const mapped = key ? COL_TO_SORT[key] : null;
    if (mapped) {
      filters.set("ordenarPor", mapped);
      filters.set("direccion", dir === "asc" ? "asc" : "desc");
    }
  };

  // Presupuesto: dividimos MXN y USD para no ahogar la card cuando hay ambas monedas.
  const presupuestoMxnLabel = totalPresupuestadoMxn > 0 ? formatCurrency(totalPresupuestadoMxn, "MXN") : null;
  const presupuestoUsdLabel = totalPresupuestadoUsd > 0 ? formatCurrency(totalPresupuestadoUsd, "USD") : null;
  const presupuestoValue = presupuestoMxnLabel ?? presupuestoUsdLabel ?? formatCurrency(0, "MXN");
  const presupuestoSublabel = presupuestoMxnLabel && presupuestoUsdLabel ? presupuestoUsdLabel : undefined;

  return (
    <PageContainer>
      <PageHeader
        icon={<Ship className="h-6 w-6 text-accent" />}
        title={`CxP — Por capturar${data.length > 0 ? ` · ${data.length}` : ""}`}
        description="Embarques con costos presupuestados. Captura las facturas de proveedor y concílialas contra el embarque."
      />




      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          icon={Ship}
          label="Embarques pendientes"
          value={data.length}
        />
        <KpiCard
          icon={Coins}
          label="Costo presupuestado"
          value={presupuestoValue}
          sublabel={presupuestoSublabel}
        />

        <KpiCard
          icon={FileStack}
          label="Facturas capturadas"
          value={facturasCapturadas}
        />
      </div>

      <CxpPorCapturarToolbar
        state={filters.state}
        set={filters.set}
        toggleDireccion={filters.toggleDireccion}
        reset={filters.reset}
        isFiltered={filters.isFiltered}
        totalFiltradas={filters.filtradas.length}
        totalGlobal={data.length}
      />

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-destructive mb-3" />
              <h3 className="text-base font-semibold">No se pudo cargar la bandeja</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Revisa tu conexión y vuelve a intentar. Si el problema persiste, contacta a soporte.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : !isLoading && data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Sin embarques pendientes de captura</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Cuando operaciones presupueste costos en un embarque, aparecerá aquí para capturar las facturas del proveedor.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/embarques">Ver todos los embarques</Link>
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filters.filtradas}
              isLoading={isLoading}
              rowKey={(r) => r.embarque_id}
              density="compact"
              sortMode="server"
              controlledSort={controlledSort}
              onSortChange={handleSortChange}
              getRowHref={(r) => `/embarques/${r.embarque_id}`}
              getRowAriaLabel={(r) => `Ver embarque ${r.expediente ?? ""}`}
              stickyHeader
              emptyMessage="Ningún embarque coincide con los filtros"
              emptyState={
                <div className="text-center py-10">
                  <p className="text-muted-foreground mb-3">Ningún embarque coincide con los filtros.</p>
                  <Button variant="outline" size="sm" onClick={filters.reset}>Limpiar filtros</Button>
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor
        open={!!picked}
        onOpenChange={(o) => { if (!o) setPicked(null); }}
        initialEmbarqueAdHoc={picked}
      />
    </PageContainer>
  );
}
