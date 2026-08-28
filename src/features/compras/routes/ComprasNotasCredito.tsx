/**
 * /compras/notas-credito — Ola E. Listado global de notas de crédito de proveedor.
 */
import { useMemo } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import { ReceiptText, Download, Banknote, Coins, ListFilter } from "lucide-react";
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
  listarNotasCreditoGlobal,
  type NotaCreditoRow,
} from "@/features/compras/services/notasCreditoGlobal";
import { buildNotasCreditoColumns } from "./_sections/notasCreditoColumns";
import { todayLocalISO } from "@/lib/date/today";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";

const MONEDAS_FILTRO = ["todas", "MXN", "USD"] as const;
type MonedaFiltro = (typeof MONEDAS_FILTRO)[number];
const ESTADOS_FILTRO = ["todos", "Borrador", "Aprobada", "Aplicada", "Cancelada"] as const;
type EstadoFiltro = (typeof ESTADOS_FILTRO)[number] & ("todos" | NotaCreditoRow["estado"]);

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function today(): string {
  return todayLocalISO();
}

export default function ComprasNotasCredito() {
  // M8 (Ola 8): filtros en la URL → el listado se puede compartir por link.
  const [desde, setDesde] = useTextoUrl("desde", firstOfYear());
  const [hasta, setHasta] = useTextoUrl("hasta", today());
  const [moneda, setMoneda] = useFiltroUrl<MonedaFiltro>("moneda", MONEDAS_FILTRO, "todas");
  const [estado, setEstado] = useFiltroUrl<EstadoFiltro>("estado", ESTADOS_FILTRO, "todos");
  const [search, setSearch] = useTextoUrl("q");

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: compras.notasCreditoGlobal({ desde, hasta, moneda, estado, search }),
    queryFn: () =>
      listarNotasCreditoGlobal({
        desde,
        hasta,
        moneda: moneda === "todas" ? undefined : moneda,
        estado: estado === "todos" ? undefined : estado,
        search: search.trim() || undefined,
      }),
  });

  const totalMxn = rows
    .filter((r) => r.moneda === "MXN" && r.estado === "Aplicada")
    .reduce((a, r) => a + r.monto, 0);
  const totalUsd = rows
    .filter((r) => r.moneda === "USD" && r.estado === "Aplicada")
    .reduce((a, r) => a + r.monto, 0);

  const columns = useMemo(() => buildNotasCreditoColumns(), []);


  const handleExport = () => {
    try {
      const csv = toCSV(
        rows.map((r) => ({
          fecha: r.fecha,
          folio_nc: r.folio_nc ?? "",
          proveedor: r.proveedor_nombre ?? "",
          factura: r.factura_folio_interno ?? "",
          folio_proveedor: r.factura_folio_proveedor ?? "",
          motivo: r.motivo,
          estado: r.estado,
          moneda: r.moneda,
          monto: r.monto,
          descripcion: r.descripcion ?? "",
        })),
      );
      descargarBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `notas-credito-proveedor-${desde}-${hasta}.csv`);
      notifySuccess(undefined, { title: "CSV descargado", description: `${rows.length} notas de crédito exportadas.` });
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        error: e,
        method: "EXPORT_NC_CSV",
      });
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<ReceiptText className="h-6 w-6 text-accent" />}
        title="Notas de crédito de proveedor"
        description="Listado global de notas de crédito. Sólo las Aplicadas reducen el saldo a pagar."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="NC en el período" value={String(rows.length)} icon={ListFilter} />
        <KpiCard label="Aplicadas MXN" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} variant="success" />
        <KpiCard label="Aplicadas USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} variant="success" />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nc-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-hasta">{RANGO_HASTA_LABEL}</Label>
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
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Emitida">Emitida</SelectItem>
                <SelectItem value="Aplicada">Aplicada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio NC o factura…" />
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
            emptyMessage="No hay notas de crédito en el período"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={ReceiptText}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.embebida}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
