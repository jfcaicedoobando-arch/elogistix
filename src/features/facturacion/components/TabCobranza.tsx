import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/shared/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { usePermissions } from "@/hooks/shared";
import { useCobranza } from "@/features/facturacion/hooks";
import { useUltimosRecordatorios, useEnviarRecordatorio } from "@/features/facturacion/hooks/useRecordatorios";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { buildCobranzaColumns } from "./cobranzaColumns";
import { DialogRegistrarPago } from "./DialogRegistrarPago";
import { DialogNotaCredito } from "./DialogNotaCredito";
import { DialogHistorialPagos } from "./DialogHistorialPagos";
import { NotasCreditoRecientes } from "./NotasCreditoRecientes";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCobranza, EstatusCobranza } from "@/features/facturacion/services";

const ESTATUS: Array<EstatusCobranza | "todos"> = ["todos", "Vigente", "Por vencer", "Vencida"];

function KPICard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "danger" }) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function TabCobranza() {
  const { canEdit, isAdmin, isSuperAdmin } = usePermissions();
  const canApprove = isAdmin || isSuperAdmin;
  const [search, setSearch] = useState("");
  const [estatus, setEstatus] = useState<EstatusCobranza | "todos">("todos");
  const [moneda, setMoneda] = useState<"todas" | "MXN" | "USD" | "EUR">("todas");

  const { data = [], isLoading, kpis } = useCobranza({
    search: search || undefined,
    estatus,
    moneda,
  });
  const { data: cxp = [] } = useFacturasCxP({});

  const [pagoFactura, setPagoFactura] = useState<FacturaCobranza | null>(null);
  const [ncFactura, setNcFactura] = useState<FacturaCobranza | null>(null);
  const [detalleFactura, setDetalleFactura] = useState<FacturaCobranza | null>(null);

  const handlePdf = async () => {
    await descargarPdf(
      <ReporteCarteraDocument
        fechaCorte={new Date().toISOString().slice(0, 10)}
        cxc={data} cxp={cxp}
      />,
      `Reporte_Cartera_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const facturaIds = useMemo(() => data.map((f) => f.id), [data]);
  const { data: recordatoriosMap } = useUltimosRecordatorios(facturaIds);
  const enviar = useEnviarRecordatorio();

  const columns = useMemo(
    () => buildCobranzaColumns({
      canEdit,
      onRegistrarPago: setPagoFactura,
      onCrearNC: setNcFactura,
      onVerDetalle: setDetalleFactura,
      onEnviarRecordatorio: (f) => enviar.mutate({ factura_id: f.id }),
      recordatoriosMap,
      recordatorioPendingId: enviar.isPending ? enviar.variables?.factura_id ?? null : null,
    }),
    [canEdit, recordatoriosMap, enviar],
  );

  const pagoAdapter = pagoFactura
    ? { id: pagoFactura.id, numero: pagoFactura.numero, total: pagoFactura.saldo, moneda: pagoFactura.moneda }
    : null;
  const ncAdapter = ncFactura
    ? {
      id: ncFactura.id, numero: ncFactura.numero, total: ncFactura.total,
      saldo: ncFactura.saldo, moneda: ncFactura.moneda, tipo_cambio: ncFactura.tipo_cambio,
    }
    : null;
  const detalleAdapter = detalleFactura
    ? { id: detalleFactura.id, numero: detalleFactura.numero, total: detalleFactura.total, moneda: detalleFactura.moneda, tipo_cambio: detalleFactura.tipo_cambio }
    : null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPICard label="Saldo MXN" value={formatCurrency(kpis.total_mxn, "MXN")} />
        <KPICard label="Saldo USD" value={formatCurrency(kpis.total_usd, "USD")} />
        <KPICard label={`Vencido (${kpis.facturas_vencidas})`} value={`${formatCurrency(kpis.vencido_mxn, "MXN")} · ${formatCurrency(kpis.vencido_usd, "USD")}`} tone="danger" />
        <KPICard label="Por vencer 7 días" value={`${formatCurrency(kpis.por_vencer_7d_mxn, "MXN")} · ${formatCurrency(kpis.por_vencer_7d_usd, "USD")}`} tone="warn" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[220px]" />
          <Select value={estatus} onValueChange={(v) => setEstatus(v as EstatusCobranza | "todos")}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTATUS.map((e) => <SelectItem key={e} value={e}>{e === "todos" ? "Todos los estatus" : e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={moneda} onValueChange={(v) => setMoneda(v as typeof moneda)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePdf}>
            <FileText className="h-4 w-4 mr-2" /> Reporte PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            emptyMessage="No hay facturas pendientes de cobrar"
            rowKey={(f) => f.id}
            density="comfortable"
          />
        </CardContent>
      </Card>

      <NotasCreditoRecientes />


      <DialogRegistrarPago
        open={!!pagoAdapter}
        onOpenChange={(o) => !o && setPagoFactura(null)}
        factura={pagoAdapter}
      />
      <DialogNotaCredito
        open={!!ncAdapter}
        onOpenChange={(o) => !o && setNcFactura(null)}
        factura={ncAdapter}
        canApprove={canApprove}
      />
      <DialogHistorialPagos
        open={!!detalleAdapter}
        onOpenChange={(o) => !o && setDetalleFactura(null)}
        factura={detalleAdapter}
        canEdit={canEdit}
      />
    </>
  );
}
