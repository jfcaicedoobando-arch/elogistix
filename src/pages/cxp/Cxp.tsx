import { useMemo, useState } from "react";
import { Plus, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrency } from "@/lib/formatters";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useFacturasCxP, useEliminarFacturaProveedor } from "@/hooks/cxp";
import { buildCxPColumns } from "@/components/cxp/cxpColumns";
import { DialogNuevaFacturaProveedor } from "@/components/cxp/DialogNuevaFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/components/cxp/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/components/cxp/DialogDetallePagosProveedor";
import { useCobranza } from "@/hooks/facturacion";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCxP, EstatusCxP } from "@/services/cxp/proveedorFacturas";

const ESTATUS: Array<EstatusCxP | "todos"> = ["todos", "Vigente", "Por vencer", "Vencida"];

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

export default function Cxp() {
  const { canEdit, isAdmin } = usePermissions();
  const [search, setSearch] = useState("");
  const [estatus, setEstatus] = useState<EstatusCxP | "todos">("todos");
  const [moneda, setMoneda] = useState<"todas" | "MXN" | "USD" | "EUR">("todas");

  const { data = [], isLoading, kpis } = useFacturasCxP({
    search: search || undefined, estatus, moneda,
  });
  const { data: cxc = [] } = useCobranza({});

  const handlePdf = async () => {
    await descargarPdf(
      <ReporteCarteraDocument
        fechaCorte={new Date().toISOString().slice(0, 10)}
        cxc={cxc} cxp={data}
      />,
      `Reporte_Cartera_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const [openNueva, setOpenNueva] = useState(false);
  const [pagar, setPagar] = useState<FacturaCxP | null>(null);
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);

  const eliminar = useEliminarFacturaProveedor();
  const onEliminar = (f: FacturaCxP) => {
    if (f.pagado > 0) return toast.error("No se puede eliminar: la factura tiene pagos registrados");
    if (!window.confirm(`¿Eliminar la factura ${f.folio_proveedor}? Esta acción se puede revertir desde Papelera.`)) return;
    eliminar.mutate(f.id, {
      onSuccess: () => toast.success("Factura eliminada"),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const columns = useMemo(
    () => buildCxPColumns({
      canEdit, onRegistrarPago: setPagar, onVerDetalle: setDetalle, onEliminar,
    }),
    [canEdit],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas por Pagar"
        description="Facturas recibidas de proveedores y su saldo pendiente"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePdf}>
              <FileText className="h-4 w-4 mr-2" /> Reporte PDF
            </Button>
            {isAdmin && (
              <Button onClick={() => setOpenNueva(true)}>
                <Plus className="h-4 w-4 mr-2" /> Capturar factura
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPICard label="Por pagar MXN" value={formatCurrency(kpis.por_pagar_mxn, "MXN")} />
        <KPICard label="Por pagar USD" value={formatCurrency(kpis.por_pagar_usd, "USD")} />
        <KPICard
          label={`Vencido (${kpis.facturas_vencidas})`}
          value={`${formatCurrency(kpis.vencido_mxn, "MXN")} · ${formatCurrency(kpis.vencido_usd, "USD")}`}
          tone="danger"
        />
        <KPICard
          label="Por vencer 7 días"
          value={`${formatCurrency(kpis.por_vencer_7d_mxn, "MXN")} · ${formatCurrency(kpis.por_vencer_7d_usd, "USD")}`}
          tone="warn"
        />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar folio o proveedor..." className="flex-1 min-w-[220px]" />
          <Select value={estatus} onValueChange={(v) => setEstatus(v as EstatusCxP | "todos")}>
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            emptyMessage="No hay facturas de proveedor capturadas"
            rowKey={(f) => f.id}
            density="comfortable"
          />
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor open={openNueva} onOpenChange={setOpenNueva} />
      <DialogRegistrarPagoProveedor
        open={!!pagar}
        onOpenChange={(o) => !o && setPagar(null)}
        factura={pagar}
      />
      <DialogDetallePagosProveedor
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
        factura={detalle}
        canEdit={canEdit}
      />
    </div>
  );
}
