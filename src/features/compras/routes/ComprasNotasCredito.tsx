/**
 * /compras/notas-credito — Ola E. Listado global de notas de crédito de proveedor.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReceiptText, Download, Wallet, Coins, ListFilter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  listarNotasCreditoGlobal,
  type NotaCreditoRow,
} from "@/features/compras/services/notasCreditoGlobal";

type MonedaFiltro = "todas" | "MXN" | "USD";
type EstadoFiltro = "todos" | NotaCreditoRow["estado"];

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function EstadoBadge({ estado }: { estado: NotaCreditoRow["estado"] }) {
  if (estado === "Aplicada") {
    return <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">Aplicada</Badge>;
  }
  if (estado === "Cancelada") {
    return <Badge variant="destructive">Cancelada</Badge>;
  }
  return <Badge variant="secondary">{estado}</Badge>;
}

export default function ComprasNotasCredito() {
  const [desde, setDesde] = useState<string>(firstOfYear());
  const [hasta, setHasta] = useState<string>(today());
  const [moneda, setMoneda] = useState<MonedaFiltro>("todas");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["compras", "notas-credito-global", { desde, hasta, moneda, estado, search }],
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

  const columns = useMemo(
    () =>
      defineColumns<NotaCreditoRow>([
        {
          id: "fecha",
          header: "Fecha",
          accessorFn: (r) => r.fecha,
          cell: ({ row }) => formatDate(row.original.fecha),
        },
        {
          id: "folio_nc",
          header: "Folio NC",
          accessorFn: (r) => r.folio_nc ?? "—",
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.folio_nc ?? "—"}</span>
          ),
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
          id: "factura",
          header: "Factura",
          accessorFn: (r) => r.factura_folio_interno ?? "—",
          cell: ({ row }) => (
            <div className="flex flex-col text-xs">
              <span>{row.original.factura_folio_interno ?? "—"}</span>
              {row.original.factura_folio_proveedor && (
                <span className="text-muted-foreground">
                  Prov: {row.original.factura_folio_proveedor}
                </span>
              )}
            </div>
          ),
        },
        {
          id: "motivo",
          header: "Motivo",
          accessorFn: (r) => r.motivo,
        },
        {
          id: "estado",
          header: "Estado",
          accessorFn: (r) => r.estado,
          cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
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
    <PageContainer>
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
        <KpiCard label="Aplicadas MXN" value={formatCurrency(totalMxn, "MXN")} icon={Wallet} variant="success" />
        <KpiCard label="Aplicadas USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} variant="success" />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nc-desde" className="text-xs">Desde</Label>
            <Input id="nc-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-hasta" className="text-xs">Hasta</Label>
            <Input id="nc-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
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
            <Label className="text-xs">Estado</Label>
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
            <Label className="text-xs">Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio NC, factura, proveedor…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay notas de crédito en el período"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={ReceiptText}
            rowKey={(r) => r.id}
            density="compact"
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
