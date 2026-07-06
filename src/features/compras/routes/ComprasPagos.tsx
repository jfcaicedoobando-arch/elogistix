/**
 * /compras/pagos — Ola E. Listado global de pagos a proveedor.
 *
 * Muestra todos los pagos aplicados, con filtros por rango de fechas,
 * método de pago, moneda y búsqueda por folio/proveedor/referencia.
 * KPIs de total pagado (MXN, USD) y conteo. Exporta a CSV.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Download, Wallet, Coins, ListFilter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/components/shared/utils/appFeedback";
import {
  listarPagosProveedorGlobal,
  type PagoProveedorRow,
} from "@/features/compras/services/pagosGlobal";

type MonedaFiltro = "todas" | "MXN" | "USD";

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ComprasPagos() {
  const [desde, setDesde] = useState<string>(firstOfMonth());
  const [hasta, setHasta] = useState<string>(today());
  const [moneda, setMoneda] = useState<MonedaFiltro>("todas");
  const [metodoPago, setMetodoPago] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["compras", "pagos-global", { desde, hasta, moneda, metodoPago, search }],
    queryFn: () =>
      listarPagosProveedorGlobal({
        desde,
        hasta,
        moneda: moneda === "todas" ? undefined : moneda,
        metodoPago: metodoPago === "todos" ? undefined : metodoPago,
        search: search.trim() || undefined,
      }),
  });

  const metodosDisponibles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.metodo_pago && set.add(r.metodo_pago));
    return Array.from(set).sort();
  }, [rows]);

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.monto, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.monto, 0);

  const columns = useMemo(
    () =>
      defineColumns<PagoProveedorRow>([
        {
          id: "fecha_pago",
          header: "Fecha",
          accessorFn: (r) => r.fecha_pago,
          cell: ({ row }) => formatDate(row.original.fecha_pago),
        },
        {
          id: "proveedor",
          header: "Proveedor",
          accessorFn: (r) => r.proveedor_nombre ?? "—",
          cell: ({ row }) => (
            <span className="font-medium">{row.original.proveedor_nombre ?? "—"}</span>
          ),
        },
        {
          id: "folio",
          header: "Folio interno",
          accessorFn: (r) => r.factura_folio_interno ?? "—",
        },
        {
          id: "folio_prov",
          header: "Folio proveedor",
          accessorFn: (r) => r.factura_folio_proveedor ?? "—",
        },
        {
          id: "metodo",
          header: "Método",
          accessorFn: (r) => r.metodo_pago,
        },
        {
          id: "referencia",
          header: "Referencia",
          accessorFn: (r) => r.referencia ?? "—",
          cell: ({ row }) =>
            row.original.referencia ? (
              <span className="font-mono text-xs">{row.original.referencia}</span>
            ) : "—",
        },
        {
          id: "monto",
          header: "Monto",
          accessorFn: (r) => r.monto,
          cell: ({ row }) => (
            <span className="tabular-nums font-medium">
              {formatCurrency(row.original.monto, row.original.moneda)}
            </span>
          ),
          meta: { align: "right" },
        },
      ]),
    [],
  );

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
    <PageContainer>
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
        <KpiCard label="Total MXN" value={formatCurrency(totalMxn, "MXN")} icon={Wallet} />
        <KpiCard label="Total USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="p-desde" className="text-xs">Desde</Label>
            <Input id="p-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-hasta" className="text-xs">Hasta</Label>
            <Input id="p-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Moneda</Label>
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
            <Label className="text-xs">Método de pago</Label>
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
            <Label className="text-xs">Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio, proveedor, referencia…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay pagos en el período seleccionado"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={Landmark}
            rowKey={(r) => r.id}
            density="compact"
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
