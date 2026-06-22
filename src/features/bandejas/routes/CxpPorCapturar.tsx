import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, FileStack, Inbox, Package, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { useCxpPorCapturarFilters } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";
import { resumirCxpPorCapturar } from "@/features/bandejas/domain/aggregates";
import { CxpPorCapturarToolbar } from "@/features/bandejas/components/CxpPorCapturarToolbar";
import { CxpPorCapturarRow } from "@/features/bandejas/components/CxpPorCapturarRow";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import type { EmbarqueSeleccionado } from "@/features/cxp/components/SugerirEmbarqueBlock";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="text-2xl font-semibold tabular-nums">{value}</CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function CxpPorCapturar() {
  const { data = [], isLoading } = useCxpPorCapturar();
  const { totalPresupuestado, facturasCapturadas } = resumirCxpPorCapturar(data);
  const filters = useCxpPorCapturarFilters(data);
  const [picked, setPicked] = useState<EmbarqueSeleccionado | null>(null);

  const handleCapturar = (row: RowData) => {
    setPicked({
      embarqueId: row.embarque_id,
      expediente: row.expediente ?? row.embarque_id.slice(0, 8),
      concepto: "Servicios proveedor",
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CxP — Por capturar</h1>
        <p className="text-muted-foreground">
          Embarques con costos presupuestados. Captura las facturas de proveedor y conciliálas contra el embarque.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<Package className="h-4 w-4" />} title="Embarques pendientes" value={data.length} />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          title="Costo presupuestado (MXN)"
          value={formatCurrency(totalPresupuestado, "MXN")}
        />
        <StatCard icon={<FileStack className="h-4 w-4" />} title="Facturas capturadas" value={facturasCapturadas} />
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
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead className="text-center">Estatus</TableHead>
                <TableHead className="text-center">Facturas</TableHead>
                <TableHead>Última factura</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <SkeletonRows />}
              {!isLoading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Sin embarques pendientes de captura.
                    <div className="mt-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/embarques">Ver todos los embarques</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data.length > 0 && filters.filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Ningún embarque coincide con los filtros.
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={filters.reset}>Limpiar filtros</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filters.filtradas.map((row) => (
                <CxpPorCapturarRow key={row.embarque_id} row={row} onCapturar={handleCapturar} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor
        open={!!picked}
        onOpenChange={(o) => { if (!o) setPicked(null); }}
        initialEmbarqueAdHoc={picked}
      />
    </div>
  );
}
