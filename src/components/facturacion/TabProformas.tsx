import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { useTabProformasController } from "@/hooks/facturacion/useTabProformasController";
import { DialogMarcarFacturada } from "./DialogMarcarFacturada";

export function TabProformas() {
  const c = useTabProformasController();

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

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={c.columns}
            data={c.paginated}
            isLoading={c.isLoading}
            emptyMessage="No hay proformas generadas"
            rowKey={(p) => p.id}
            density="comfortable"
            pagination={{
              page: c.page,
              totalPages: c.totalPages,
              onPageChange: c.setPage,
              pageSize: c.pageSize,
              onPageSizeChange: (s) => { c.setPageSize(s); c.setPage(0); },
            }}
          />
        </CardContent>
      </Card>

      <DialogMarcarFacturada
        open={!!c.proformaAFacturar}
        onOpenChange={(o) => !o && c.setProformaAFacturar(null)}
        proforma={c.proformaAFacturar}
      />
    </div>
  );
}
