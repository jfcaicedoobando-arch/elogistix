/**
 * /compras/pagos — Ola E. Listado global de pagos a proveedor.
 *
 * Muestra todos los pagos aplicados, con filtros por rango de fechas,
 * método de pago, moneda y búsqueda por folio/proveedor/referencia.
 * KPIs de total pagado (MXN, USD) y conteo. Exporta a CSV.
 */
import { useMemo } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import { Landmark, Download, Banknote, Coins, ListFilter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import {
  listarPagosProveedorGlobal,
} from "@/features/compras/services/pagosGlobal";
import { buildPagosColumns } from "./_sections/pagosColumns";
import { todayLocalISO } from "@/lib/date/today";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";

const MONEDAS_FILTRO = ["todas", "MXN", "USD"] as const;
type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  return todayLocalISO();
}

export default function ComprasPagos() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [desde, setDesde] = useTextoUrl("desde", firstOfMonth());
  const [hasta, setHasta] = useTextoUrl("hasta", today());
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [metodoPago, setMetodoPago] = useTextoUrl("metodo", "todos");
  const [search, setSearch] = useTextoUrl("q");
  const { organizationId } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: [...compras.pagosGlobal({ desde, hasta, moneda, metodoPago, search }), organizationId],
    queryFn: () =>
      listarPagosProveedorGlobal(
        {
          desde,
          hasta,
          moneda: moneda === "todas" ? undefined : moneda,
          metodoPago: metodoPago === "todos" ? undefined : metodoPago,
          search: search.trim() || undefined,
        },
        organizationId,
      ),
  });

  const metodosDisponibles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.metodo_pago && set.add(r.metodo_pago));
    return Array.from(set).sort();
  }, [rows]);

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.monto, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.monto, 0);

  const columns = useMemo(() => buildPagosColumns(), []);


  const handleExport = () => {
    try {
      const csv = toCSV(
        rows.map((r) => ({
          fecha: r.fecha_pago,
          proveedor: r.proveedor_nombre ?? "",
          folio_interno: r.factura_folio_interno ?? "",
          folio_proveedor: r.factura_folio_proveedor ?? "",
          metodo: r.metodo_pago,
          referencia: r.referencia ?? "",
          moneda: r.moneda,
          monto: r.monto,
          tipo_cambio_usd: r.tipo_cambio_usd ?? "",
        })),
      );
      descargarBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `pagos-proveedor-${desde}-${hasta}.csv`);
      notifySuccess(undefined, { title: "CSV descargado", description: `${rows.length} pagos exportados.` });
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        error: e,
        method: "EXPORT_PAGOS_CSV",
      });
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<Landmark className="h-6 w-6 text-accent" />}
        title="Pagos a proveedor"
        description="Listado global de pagos aplicados a facturas de proveedor."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Pagos en el período" value={String(rows.length)} icon={ListFilter} />
        <KpiCard label="Total MXN" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} />
        <KpiCard label="Total USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="p-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-hasta">{RANGO_HASTA_LABEL}</Label>
            <DatePickerMx value={hasta} onChange={setHasta} />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Método de pago</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {metodosDisponibles.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio o proveedor…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <ErrorState className="m-4" onRetry={() => void refetch()} />
          ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay pagos en el período seleccionado"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={Landmark}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.embebida}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
