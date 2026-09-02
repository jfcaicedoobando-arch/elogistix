/**
 * Cartera — facturas emitidas con saldo pendiente.
 *
 * v13.173.0 (Ola 1 · Filtros globales): migrada al primitivo unificado
 * `useClientPagedList` — search, filtros (moneda / vencidas), rango de fechas
 * de vencimiento, orden y paginación sincronizados con la URL vía `nuqs`, y
 * barra `<UnifiedFiltersBar />` compartida con Facturación/Embarques.
 * v13.313.1: agregado diálogo de recordatorio de cobranza.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Inbox } from "lucide-react";
import { useCarteraPage } from "@/features/bandejas/hooks/useCarteraPage";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { CarteraMobileCard } from "@/features/bandejas/components/CarteraMobileCard";
import { CarteraKpis } from "./_sections/CarteraKpis";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from "@/features/cobranza/components/DialogRecordatorioCobranza";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import { DialogCobroLoteCliente } from "@/features/facturacion/components/DialogCobroLoteCliente";
import { derivarLoteCobro, hayEnTramiteCancelacion } from "./_sections/carteraLote";
import { CarteraSelectionBar } from "./_sections/CarteraSelectionBar";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useDocumentTitle } from "@/hooks/shared";
import { FILTRO_ANCHO } from "@/lib/ui/filterWidths";


export default function Cartera() {
  useDocumentTitle("Cobranza");
  const [recordatorio, setRecordatorio] = useState<FacturaRecordatorio | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [loteOpen, setLoteOpen] = useState(false);
  // RFE-04 (Ola 11): /cartera admite gerentes de sólo lectura, pero la RPC
  // `registrar_pago_cliente_lote` rechaza con 42501 a quien no está en
  // REGISTRAR_COBRO. No ofrecer selección ni botón a esos roles (patrón FE-10).
  const { canRegistrarCobro } = usePermissions();
  const {
    data,
    paged,
    monedas,
    scoped,
    saldosNativos,
    vencidasCount,
    vencidoNativo,
    eqTotal,
    eqVencido,
    isLoading,
    isError,
    refetch,
    columns,
  } = useCarteraPage((row) => setRecordatorio(row));

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const seleccionadas = useMemo(
    () => data.filter((r) => selectedIds.includes(r.factura_id)),
    [data, selectedIds],
  );
  const lote = useMemo(() => derivarLoteCobro(seleccionadas), [seleccionadas]);
  const hayEnCancelacion = useMemo(() => hayEnTramiteCancelacion(seleccionadas), [seleccionadas]);

  return (
    <PageContainer>
      <PageHeader
        title="Cobranza"
        description="Facturas vencidas y por vencer en los próximos 7 días. Cambia el filtro de urgencia para ver toda la cartera."
      />
      {canRegistrarCobro && (
        <CarteraSelectionBar
          total={selectedIds.length}
          lote={lote}
          hayEnCancelacion={hayEnCancelacion}
          onCobroLote={() => setLoteOpen(true)}
          onLimpiar={() => setRowSelection({})}
        />
      )}
      <CarteraKpis
        totalFacturas={scoped.length}
        saldosNativos={saldosNativos}
        vencidasCount={vencidasCount}
        vencidoNativo={vencidoNativo}
        eqTotal={eqTotal}
        eqVencido={eqVencido}
      />


      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar folio, cliente o expediente…"
        primary={
          <>
            <Select value={paged.filters.urgencia} onValueChange={(v) => paged.setFilter("urgencia", v)}>
              <SelectTrigger className={FILTRO_ANCHO.mdAuto} aria-label="Urgencia">
                <SelectValue placeholder="Urgencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accionable">Accionable (≤7d o vencidas)</SelectItem>
                <SelectItem value="vencidas">Solo vencidas</SelectItem>
                <SelectItem value="por_vencer">Por vencer (≤7 días)</SelectItem>
                <SelectItem value="todas">Todas con saldo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paged.filters.moneda} onValueChange={(v) => paged.setFilter("moneda", v)}>
              <SelectTrigger className={FILTRO_ANCHO.smAuto} aria-label="Moneda">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas monedas</SelectItem>
                {monedas.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        secondary={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cartera-from">{rangoLabel("Vencimiento", "desde")}</Label>
              <DatePickerMx value={paged.dateFrom} onChange={paged.setDateFrom} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartera-to">{rangoLabel("Vencimiento", "hasta")}</Label>
              <DatePickerMx value={paged.dateTo} onChange={paged.setDateTo} />
            </div>
          </div>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      {/* v13.823.25: ResponsiveDataTable unifica desktop y móvil (antes:
          DataTable + CarteraMobileList duplicados) y evita el desbordamiento
          horizontal en plegables (~692px). */}
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={paged.rows}
            rowKey={(r) => r.factura_id}
            isLoading={paged.isLoading}
            isError={isError}
            onRetry={refetch}
            getRowHref={(r) => `/facturacion/${r.factura_id}`}
            getRowAriaLabel={(r) => `Ver factura ${r.numero ?? ""}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            emptyIcon={Inbox}
            emptyMessage="Sin cartera pendiente"
            emptyHint="¡Todo cobrado!"
            rowSelection={canRegistrarCobro ? rowSelection : undefined}
            onRowSelectionChange={canRegistrarCobro ? setRowSelection : undefined}
            mobileCard={(r) => <CarteraMobileCard row={r} />}
          />
        </CardContent>
      </Card>

      {lote && canRegistrarCobro && (
        <DialogCobroLoteCliente
          open={loteOpen}
          onOpenChange={setLoteOpen}
          clienteId={lote.clienteId}
          clienteNombre={lote.clienteNombre}
          moneda={lote.moneda}
          facturas={lote.facturas}
          onDone={() => setRowSelection({})}
        />
      )}

      <DialogRecordatorioCobranza
        open={recordatorio !== null}
        onOpenChange={(open) => !open && setRecordatorio(null)}
        factura={recordatorio}
      />

    </PageContainer>
  );
}
