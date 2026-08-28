/**
 * Tesorería › Pagos (libro maestro).
 *
 * Lista transversal de cobros de clientes, pagos a proveedores y anticipos,
 * con filtros por periodo, cuenta, moneda, método SAT y conciliación, más
 * drill-down a la factura y al movimiento bancario.
 */
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { useDocumentTitle } from "@/hooks/shared";
import { DataTable } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useLibroPagos } from "@/features/tesoreria/hooks/useLibroPagos";
import { useFiltrosLibroPagosUrl } from "@/features/tesoreria/hooks/useFiltrosLibroPagosUrl";
import {
  VISTA_LABELS, filtrarPagos, metodosDisponibles,
  monedasDisponibles, totalesLibroPagos,
  type VistaLibroPagos,
} from "@/features/tesoreria/domain/libroPagos";
import { etiquetaCuenta } from "@/features/anticipos-proveedor/domain/etiquetaCuenta";
import { DetallePagoSheet } from "@/features/tesoreria/components/DetallePagoSheet";
import { refPagoDeLibro, type RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { libroPagosColumns } from "./_sections/libroPagosColumns";
import { LibroPagosToolbar } from "./_sections/LibroPagosToolbar";
import { LibroPagosKpis } from "./_sections/LibroPagosKpis";
import { LibroPagosExportButtons } from "./_sections/LibroPagosExportButtons";

export default function TesoreriaPagos() {
  useDocumentTitle("Tesorería · Pagos");
  const { data: cuentasRaw = [] } = useCuentasBancarias();
  // M8 (Ola 8): periodo y filtros viven en la URL (enlace compartible).
  const { rango, setRango, filtros, actualizarFiltros } = useFiltrosLibroPagosUrl();
  const [pagoAbierto, setPagoAbierto] = useState<RefPago | null>(null);

  const { data: libro, isLoading, isError, refetch } = useLibroPagos(rango.desde, rango.hasta);
  const pagos = useMemo(() => libro?.pagos ?? [], [libro]);

  const cuentas = useMemo(
    () => cuentasRaw.map((c) => ({ id: c.id, alias: etiquetaCuenta(c), moneda: c.moneda })),
    [cuentasRaw],
  );
  const monedas = useMemo(() => monedasDisponibles(pagos), [pagos]);
  const metodos = useMemo(() => metodosDisponibles(pagos), [pagos]);
  const visibles = useMemo(() => filtrarPagos(pagos, filtros), [pagos, filtros]);
  const totales = useMemo(() => totalesLibroPagos(visibles), [visibles]);
  const columns = useMemo(() => libroPagosColumns(), []);

  return (
    <PageContainer>
      <PageHeader
        title="Pagos"
        description="Todos los cobros de clientes, pagos a proveedores y anticipos en un solo lugar"
        actions={<LibroPagosExportButtons pagos={visibles} rango={rango} totales={totales} />}
      />

      <Tabs
        value={filtros.vista}
        onValueChange={(v) => actualizarFiltros({ vista: v as VistaLibroPagos })}
      >
        <TabsList>
          {(Object.keys(VISTA_LABELS) as VistaLibroPagos[]).map((v) => (
            <TabsTrigger key={v} value={v}>{VISTA_LABELS[v]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <LibroPagosToolbar
        cuentas={cuentas}
        monedas={monedas}
        metodos={metodos}
        filtros={filtros}
        onFiltrosChange={actualizarFiltros}
        rango={rango}
        onRangoChange={setRango}
      />

      <LibroPagosKpis totales={totales} isLoading={isLoading} />

      <div className="space-y-1">
        <p className="px-1 text-body-sm text-muted-foreground">
          {visibles.length} de {pagos.length} pagos del periodo
        </p>
        <DataTable
          columns={columns}
          data={visibles}
          rowKey={(p) => `${p.tipo}-${p.id}`}
          density={TABLE_DENSITY.listado}
          striped
          stickyHeader
          tableClassName="w-full"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          onRowClick={(p) => setPagoAbierto(refPagoDeLibro(p))}
          getRowAriaLabel={(p) => `Ver detalle del pago de ${p.contraparte ?? "la contraparte"}`}
          emptyMessage="No hay pagos registrados con estos filtros."
        />
      </div>

      <DetallePagoSheet
        ref_pago={pagoAbierto}
        onOpenChange={(open) => { if (!open) setPagoAbierto(null); }}
      />
    </PageContainer>
  );
}
