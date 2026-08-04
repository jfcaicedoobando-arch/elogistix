/**
 * Bandejas de Facturación (Tabs internos) — extraído de `Facturacion.tsx`
 * para mantenerlo por debajo de 200 líneas tras envolverlo con `CargaGuard`.
 */
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BandejaTabs, type BandejaId } from "@/features/facturacion/components/bandejas/BandejaTabs";
import { BandejaPorFacturar } from "@/features/facturacion/components/bandejas/BandejaPorFacturar";
import { BandejaProformasListas } from "@/features/facturacion/components/bandejas/BandejaProformasListas";
import { BandejaPorTimbrar } from "@/features/facturacion/components/bandejas/BandejaPorTimbrar";
import { BandejaPorEnviar } from "@/features/facturacion/components/bandejas/BandejaPorEnviar";
import { BandejaPorCobrar } from "@/features/facturacion/components/bandejas/BandejaPorCobrar";
import { BandejaVencidas } from "@/features/facturacion/components/bandejas/BandejaVencidas";
import { BandejaRepPendientes } from "@/features/facturacion/components/bandejas/BandejaRepPendientes";
import { TabFacturasEmitidas } from "@/features/facturacion/components/TabFacturasEmitidas";
import { NotasCreditoRecientes } from "@/features/facturacion/components/NotasCreditoRecientes";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

interface ClienteOption { id: string; nombre: string }

interface Props {
  activeBandeja: BandejaId;
  setActiveBandeja: (next: string) => void;
  search: string;
  setSearch: (v: string) => void;
  filterEstado: string;
  filterCliente: string;
  setFilter: <K extends "estado" | "cliente">(k: K, v: string) => void;
  desdeIso: string | null;
  setFechaDesde: (v: string) => void;
  hastaIso: string | null;
  setFechaHasta: (v: string) => void;
  clientesDisponibles: ClienteOption[];
  clearFiltros: () => void;
  exportarFacturasCsv: () => void;
  exportarLayoutContable: () => void;
  facturaColumns: ColumnDef<Factura, unknown>[];
  onCreateNew: () => void;
  paginatedFacturas: Factura[];
  facturasFiltradas: Factura[];
  totalFacturas: number;
  loadingFacturas: boolean;
  errorFacturas: boolean;
  refetchFacturas: () => void;
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
}

export function FacturacionBandejasTabs(p: Props) {
  return (
    <Tabs value={p.activeBandeja} onValueChange={p.setActiveBandeja}>
      <div className="sticky top-0 z-20 -mx-4 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 overflow-x-auto">
        <BandejaTabs />
      </div>

      <TabsContent value="embarques-sin-factura" className="space-y-4">
        <BandejaPorFacturar />
      </TabsContent>
      <TabsContent value="proformas-listas" className="space-y-4">
        <BandejaProformasListas />
      </TabsContent>
      <TabsContent value="por-timbrar" className="space-y-4">
        <BandejaPorTimbrar />
      </TabsContent>
      <TabsContent value="por-enviar" className="space-y-4">
        <BandejaPorEnviar />
      </TabsContent>
      <TabsContent value="por-cobrar" className="space-y-4">
        <BandejaPorCobrar />
      </TabsContent>
      <TabsContent value="vencidas" className="space-y-4">
        <BandejaVencidas />
      </TabsContent>
      <TabsContent value="rep-pendientes" className="space-y-4">
        <BandejaRepPendientes />
      </TabsContent>
      <TabsContent value="emitidas" className="space-y-4">
        <TabFacturasEmitidas
          search={p.search} setSearch={p.setSearch}
          filterEstado={p.filterEstado} filterCliente={p.filterCliente} setFilter={p.setFilter}
          fechaDesde={p.desdeIso ?? ""} setFechaDesde={p.setFechaDesde}
          fechaHasta={p.hastaIso ?? ""} setFechaHasta={p.setFechaHasta}
          clientes={p.clientesDisponibles}
          onClearFiltros={p.clearFiltros}
          exportarFacturasCsv={p.exportarFacturasCsv}
          exportarLayoutContable={p.exportarLayoutContable}
          columns={p.facturaColumns}
          onCreateNew={p.onCreateNew}
          data={p.paginatedFacturas}
          facturasFiltradas={p.facturasFiltradas}
          totalFacturas={p.totalFacturas}
          isLoading={p.loadingFacturas}
          isError={p.errorFacturas}
          onRetry={p.refetchFacturas}
          page={p.page} totalPages={p.totalPages} setPage={p.setPage}
          pageSize={p.pageSize} setPageSize={p.setPageSize}
        />
      </TabsContent>
      <TabsContent value="notas" className="space-y-4">
        <NotasCreditoRecientes />
      </TabsContent>
    </Tabs>
  );
}
