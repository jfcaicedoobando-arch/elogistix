/**
 * Bandeja /compras/por-aprobar — Ola C.
 *
 * Lista dedicada de facturas de proveedor bajo flujo de aprobación
 * (estados: pendiente / aprobada / rechazada). Reutiliza el fetch de CxP
 * filtrando por `aprobacion`, y abre el detalle en `DialogDetallePagosProveedor`
 * donde ya vive el `BotonesAprobacionFactura` para aprobar/rechazar.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, Inbox, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import type { FacturaCxP } from "@/features/cxp/services";

type AprobacionFiltro = "pendiente" | "aprobada" | "rechazada";

function KPICard({
  icon: Icon, label, count, monto, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  monto?: string;
  tone?: "default" | "warn" | "success" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive"
    : tone === "success" ? "text-success"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", toneCls)} />
          <span>{label}</span>
        </p>
        <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>
          {count} <span className="text-xs font-normal text-muted-foreground">
            {count === 1 ? "factura" : "facturas"}
          </span>
        </p>
        {monto && <p className="text-xs text-muted-foreground tabular-nums">{monto}</p>}
      </CardContent>
    </Card>
  );
}

function sumaMxn(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "MXN")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}
function sumaUsd(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "USD")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}

export default function ComprasPorAprobar() {
  const { canEdit } = usePermissions();
  const [aprobacion, setAprobacion] = useState<AprobacionFiltro>("pendiente");
  const [search, setSearch] = useState("");
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);

  const { data: rows = [], isLoading } = useFacturasCxP({
    aprobacion,
    search: search || undefined,
  });

  // Contadores globales por estado (sin filtro de búsqueda) para los tabs/KPIs.
  const { data: pendientes = [] } = useFacturasCxP({ aprobacion: "pendiente" });
  const { data: aprobadas = [] } = useFacturasCxP({ aprobacion: "aprobada" });
  const { data: rechazadas = [] } = useFacturasCxP({ aprobacion: "rechazada" });

  const columns = useMemo(() => buildCxPColumns(), []);

  const currentTotalMxn = useMemo(() => sumaMxn(rows), [rows]);
  const currentTotalUsd = useMemo(() => sumaUsd(rows), [rows]);

  return (
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Por aprobar"
        description="Solicitudes de aprobación de facturas de proveedor. Revisa, aprueba o rechaza cada solicitud."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={ClipboardCheck}
          label="Pendientes"
          count={pendientes.length}
          monto={`${formatCurrency(sumaMxn(pendientes), "MXN")} · ${formatCurrency(sumaUsd(pendientes), "USD")}`}
          tone="warn"
        />
        <KPICard
          icon={CheckCircle2}
          label="Aprobadas"
          count={aprobadas.length}
          tone="success"
        />
        <KPICard
          icon={XCircle}
          label="Rechazadas"
          count={rechazadas.length}
          tone="danger"
        />
        <KPICard
          icon={ClipboardCheck}
          label={`Total en vista (${aprobacion})`}
          count={rows.length}
          monto={`${formatCurrency(currentTotalMxn, "MXN")} · ${formatCurrency(currentTotalUsd, "USD")}`}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs value={aprobacion} onValueChange={(v) => setAprobacion(v as AprobacionFiltro)}>
            <TabsList>
              <TabsTrigger value="pendiente">
                Pendientes <span className="ml-1.5 text-2xs opacity-70">({pendientes.length})</span>
              </TabsTrigger>
              <TabsTrigger value="aprobada">
                Aprobadas <span className="ml-1.5 text-2xs opacity-70">({aprobadas.length})</span>
              </TabsTrigger>
              <TabsTrigger value="rechazada">
                Rechazadas <span className="ml-1.5 text-2xs opacity-70">({rechazadas.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por folio, folio proveedor o proveedor…"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">
                {aprobacion === "pendiente"
                  ? "No hay solicitudes pendientes"
                  : aprobacion === "aprobada"
                  ? "No hay facturas aprobadas"
                  : "No hay facturas rechazadas"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {aprobacion === "pendiente"
                  ? "Todas las facturas capturadas están al día. Cuando llegue una nueva solicitud aparecerá aquí."
                  : "Cambia de pestaña o ajusta la búsqueda para ver otros estados."}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="No hay facturas que coincidan con la búsqueda"
              rowKey={(f) => f.id}
              density="compact"
              initialSort={{ key: "vencimiento", dir: "asc" }}
              onRowClick={(fact) => setDetalle(fact)}
            />
          )}
        </CardContent>
      </Card>

      <DialogDetallePagosProveedor
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
        factura={detalle ? rows.find((r) => r.id === detalle.id) ?? detalle : null}
        canEdit={canEdit}
      />
    </PageContainer>
  );
}
