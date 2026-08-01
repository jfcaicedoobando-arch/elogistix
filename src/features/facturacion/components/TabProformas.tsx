import { Download, Receipt, Loader2, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable } from "@/components/shared/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { useTabProformasController, type FiltroEstadoProforma } from "@/features/facturacion/hooks";
import { buildProformasColumns } from "./proformasColumns";
import ProformasFiltros from "./ProformasFiltros";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks/useConvertirProformaDirecto";
import { usePermissions } from "@/hooks/shared";
import { useMemo } from "react";
import { todayLocalISO } from "@/lib/date/today";


export function TabProformas({ isInRange, estadoInicial }: {
  isInRange?: (fecha: string | null | undefined) => boolean;
  estadoInicial?: FiltroEstadoProforma;
}) {
  const c = useTabProformasController({ isInRange, estadoInicial });
  const { canEmitirFactura } = usePermissions();
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();

  const columns = useMemo(
    () => buildProformasColumns({
      selection: {
        selectedIds: c.selectedIds,
        toggle: c.toggleSelected,
        isSelectable: c.isConvertible,
      },
    }),
    [c.selectedIds, c.toggleSelected, c.isConvertible],
  );

  const seleccionados = c.selectedProformas.length;
  const puedeFusionar = seleccionados > 0 && c.fusionInfo.sameCliente && canEmitirFactura;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-0">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <ProformasFiltros
                search={c.search}
                onSearchChange={c.setSearch}
                filtroEstado={c.filtroEstado}
                onFiltroEstadoChange={(v) => c.setFiltroEstado(v as typeof c.filtroEstado)}
                filtroCliente={c.filtroCliente}
                onFiltroClienteChange={c.setFiltroCliente}
                filtroOperador={c.filtroOperador}
                onFiltroOperadorChange={c.setFiltroOperador}
                fechaDesde={c.fechaDesde}
                onFechaDesdeChange={c.setFechaDesde}
                fechaHasta={c.fechaHasta}
                onFechaHastaChange={c.setFechaHasta}
                clientes={c.clientesDisponibles}
                operadores={c.operadoresDisponibles}
                onClearAll={c.clearFiltros}
              />
            </div>
            <Button
              variant="outline"
              disabled={c.filtered.length === 0}
              onClick={() => exportToCsv(
                `proformas_${todayLocalISO()}.csv`,
                c.csvColumns,
                c.csvRows(),
              )}
            >
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Mostrando <strong className="text-foreground">{c.filtered.length}</strong> de {c.counts.todas} proformas
          </div>
        </CardContent>
      </Card>


      {seleccionados > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="text-sm flex-1 min-w-[240px]">
              <strong>{seleccionados}</strong> proforma{seleccionados === 1 ? "" : "s"} seleccionada{seleccionados === 1 ? "" : "s"}
              {c.fusionInfo.clienteNombre && <> · {c.fusionInfo.clienteNombre}</>}
            </div>
            {!c.fusionInfo.sameCliente && (
              <Alert variant="destructive" className="py-2 px-3 m-0 w-full md:w-auto">
                <AlertDescription className="text-xs">
                  Sólo puedes fusionar proformas del mismo cliente.
                </AlertDescription>
              </Alert>
            )}
            <Button variant="ghost" size="sm" onClick={c.clearSelected}>
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
            <Button
              size="sm"
              disabled={!puedeFusionar || convirtiendo}
              onClick={() => {
                if (!c.fusionInfo.organizationId) return;
                convertir(
                  {
                    proformaIds: c.selectedProformas.map((p) => p.id),
                    organizationId: c.fusionInfo.organizationId,
                    diasCredito: c.fusionInfo.diasCredito,
                  },
                  { onSuccess: () => c.clearSelected() },
                );
              }}
            >
              {convirtiendo
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Receipt className="h-4 w-4 mr-1" />}
              {seleccionados === 1 ? "Convertir a factura" : `Fusionar ${seleccionados} en una factura`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <DataTable
            key={c.filtroEstado}
            columns={columns}
            data={c.paginated}
            isLoading={c.isLoading}
            emptyMessage="No hay proformas generadas"
            rowKey={(p) => p.id}
            density="comfortable"
            getRowHref={(p) => `/proformas/${p.id}`}
            pagination={{
              page: c.page,
              totalPages: c.totalPages,
              onPageChange: c.setPage,
              pageSize: c.pageSize,
              onPageSizeChange: (s) => { c.setPageSize(s); c.setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
