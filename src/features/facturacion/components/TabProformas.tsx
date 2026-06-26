import { Download, FileText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { useTabProformasController } from "@/features/facturacion/hooks";
import { buildProformasColumns } from "./proformasColumns";
import { DialogMarcarFacturada } from "./DialogMarcarFacturada";
import { ConvertirAFacturaDialog } from "@/features/proformas/components/ConvertirAFacturaDialog";
import { useMemo } from "react";

export function TabProformas({ isInRange }: { isInRange?: (fecha: string | null | undefined) => boolean }) {
  const navigate = useNavigate();
  const c = useTabProformasController({ isInRange });

  const columns = useMemo(
    () => buildProformasColumns({
      descargar: c.descargar,
      downloadingId: c.downloadingId,
      onMarcarFacturada: c.setProformaAFacturar,
      selection: {
        selectedIds: c.selectedIds,
        toggle: c.toggleSelected,
        isSelectable: c.isConvertible,
      },
    }),
    [c.descargar, c.downloadingId, c.setProformaAFacturar, c.selectedIds, c.toggleSelected, c.isConvertible],
  );

  const seleccionados = c.selectedProformas.length;
  const puedeFusionar = seleccionados > 0 && c.fusionInfo.sameCliente;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={c.search}
            onChange={c.setSearch}
            placeholder="Buscar por número, expediente, cliente o folio..."
            className="flex-1 min-w-[240px]"
          />
          <ToggleGroup
            type="single"
            value={c.filtroEstado}
            onValueChange={(v) => v && c.setFiltroEstado(v as typeof c.filtroEstado)}
          >
            <ToggleGroupItem value="todas">Todas ({c.counts.todas})</ToggleGroupItem>
            <ToggleGroupItem value="pendiente">Pendientes ({c.counts.pendiente})</ToggleGroupItem>
            <ToggleGroupItem value="facturada">Facturadas ({c.counts.facturada})</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            disabled={c.filtered.length === 0}
            onClick={() => exportToCsv(
              `proformas_${new Date().toISOString().slice(0, 10)}.csv`,
              c.csvColumns,
              c.csvRows(),
            )}
          >
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
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
            <Button size="sm" disabled={!puedeFusionar} onClick={() => c.setConvertOpen(true)}>
              <FileText className="h-4 w-4 mr-1" />
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
            onRowClick={(p) => navigate(`/proformas/${p.id}`)}
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

      <DialogMarcarFacturada
        open={!!c.proformaAFacturar}
        onOpenChange={(o) => !o && c.setProformaAFacturar(null)}
        proforma={c.proformaAFacturar}
      />

      {c.convertOpen && c.fusionInfo.organizationId && puedeFusionar && (
        <ConvertirAFacturaDialog
          open={c.convertOpen}
          onOpenChange={(o) => {
            c.setConvertOpen(o);
            if (!o) c.clearSelected();
          }}
          proformaIds={c.selectedProformas.map((p) => p.id)}
          organizationId={c.fusionInfo.organizationId}
          diasCreditoDefault={c.fusionInfo.diasCredito}
        />
      )}
    </div>
  );
}
