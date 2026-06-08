import { useMemo, useState } from "react";
import { Plus, FileText, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP, useEliminarFacturaProveedor } from "@/hooks/cxp";
import { buildCxPColumns } from "@/components/cxp/cxpColumns";
import { DialogNuevaFacturaProveedor } from "@/components/cxp/DialogNuevaFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/components/cxp/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/components/cxp/DialogDetallePagosProveedor";
import { CxpFiltros } from "@/components/cxp/CxpFiltros";
import { useCobranza } from "@/hooks/facturacion";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCxP, EstatusCxP } from "@/services/cxp";

function KPICard({
  label, value, count, tone = "default",
}: {
  label: string; value: string; count?: number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneCls = tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span>{label}</span>
          {count != null && (
            <span className="text-[10px] text-muted-foreground/70">
              · {count} {count === 1 ? "factura" : "facturas"}
            </span>
          )}
        </p>
        <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Cxp() {
  const { canEdit, isAdmin } = usePermissions();
  const [search, setSearch] = useState("");
  const [estatus, setEstatus] = useState<EstatusCxP | "todos">("todos");
  const [moneda, setMoneda] = useState<"todas" | "MXN" | "USD" | "EUR">("todas");
  const [proveedorId, setProveedorId] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const { data = [], isLoading, kpis } = useFacturasCxP({
    search: search || undefined,
    estatus,
    moneda,
    proveedor_id: proveedorId === "todos" ? undefined : proveedorId,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  });
  const { data: cxc = [] } = useCobranza({});

  // Conteos por categoría para enriquecer KPIs.
  const counts = useMemo(() => {
    let porPagarMxn = 0, porPagarUsd = 0;
    let vencidasN = 0, porVencer7d = 0;
    for (const f of data) {
      if (f.saldo <= 0) continue;
      if (f.moneda === "USD") porPagarUsd++; else porPagarMxn++;
      if (f.estatus === "Vencida") vencidasN++;
      if (f.estatus === "Por vencer") porVencer7d++;
    }
    return { porPagarMxn, porPagarUsd, vencidasN, porVencer7d };
  }, [data]);

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
  const [aEliminar, setAEliminar] = useState<FacturaCxP | null>(null);

  const eliminar = useEliminarFacturaProveedor();

  const onEliminar = (f: FacturaCxP) => {
    if (f.pagado > 0) {
      toast.error("No se puede eliminar: la factura tiene pagos registrados");
      return;
    }
    setAEliminar(f);
  };

  const columns = useMemo(
    () => buildCxPColumns({
      canEdit, onRegistrarPago: setPagar, onVerDetalle: setDetalle, onEliminar,
    }),
    [canEdit],
  );

  const hayFiltros =
    search !== "" || estatus !== "todos" || moneda !== "todas" ||
    proveedorId !== "todos" || fechaDesde !== "" || fechaHasta !== "";

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
        <KPICard
          label="Por pagar MXN"
          value={formatCurrency(kpis.por_pagar_mxn, "MXN")}
          count={counts.porPagarMxn}
        />
        <KPICard
          label="Por pagar USD"
          value={formatCurrency(kpis.por_pagar_usd, "USD")}
          count={counts.porPagarUsd}
        />
        <KPICard
          label="Vencido"
          value={`${formatCurrency(kpis.vencido_mxn, "MXN")} · ${formatCurrency(kpis.vencido_usd, "USD")}`}
          count={counts.vencidasN}
          tone="danger"
        />
        <KPICard
          label="Por vencer 7 días"
          value={`${formatCurrency(kpis.por_vencer_7d_mxn, "MXN")} · ${formatCurrency(kpis.por_vencer_7d_usd, "USD")}`}
          count={counts.porVencer7d}
          tone="warn"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <CxpFiltros
            search={search} onSearchChange={setSearch}
            estatus={estatus} onEstatusChange={setEstatus}
            moneda={moneda} onMonedaChange={setMoneda}
            proveedorId={proveedorId} onProveedorChange={setProveedorId}
            fechaDesde={fechaDesde} onFechaDesdeChange={setFechaDesde}
            fechaHasta={fechaHasta} onFechaHastaChange={setFechaHasta}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && data.length === 0 && !hayFiltros ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Aún no hay facturas de proveedor</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Captura la primera factura recibida para abrir su saldo en Cuentas por Pagar
                y empezar a registrar pagos.
              </p>
              {isAdmin && (
                <Button className="mt-4" onClick={() => setOpenNueva(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Capturar primera factura
                </Button>
              )}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              isLoading={isLoading}
              emptyMessage="No hay facturas que coincidan con los filtros"
              rowKey={(f) => f.id}
              density="compact"
              onRowClick={(f) => setDetalle(f)}
            />
          )}
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
      <DoubleConfirmDeleteDialog
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        entityName={aEliminar ? `la factura ${aEliminar.folio_proveedor}` : "la factura"}
        description={aEliminar
          ? `La factura ${aEliminar.folio_proveedor} de ${aEliminar.proveedor_nombre} será enviada a la papelera.`
          : undefined}
        finalDescription="Puedes restaurarla desde la papelera si fue un error."
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!aEliminar) return;
          await eliminar.mutateAsync(aEliminar.id, {
            onSuccess: () => toast.success("Factura eliminada"),
            onError: (e) => toast.error((e as Error).message),
          });
          setAEliminar(null);
        }}
      />
    </div>
  );
}
