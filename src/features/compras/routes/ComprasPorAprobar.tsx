/** Bandeja /compras/por-aprobar — Ola C: facturas bajo flujo de aprobación. */
import { useMemo, useState } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import SearchInput from "@/components/shared/SearchInput";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP, useAprobarFacturasLote, useVerificarSatLote } from "@/features/cxp/hooks";
import { esValidableEnSat } from "@/features/cxp";
import { KpiCard } from "@/components/shared/KpiCard";
import { sumaMxn, sumaUsd } from "./ComprasPorAprobar.helpers";
import { useColumnasPorAprobar } from "./ComprasPorAprobar.useColumnas";
import { ConfirmarAprobacionLoteDialog } from "./ComprasPorAprobar.confirmDialog";
import { ComprasPorAprobarEmptyState } from "./ComprasPorAprobar.emptyState";
import { ComprasPorAprobarBulkBar } from "./ComprasPorAprobar.bulkBar";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ComprasPorAprobarMobileCard } from "@/features/compras/components/ComprasPorAprobarMobileCard";

const APROBACION_FILTROS = ["pendiente", "aprobada", "rechazada"] as const;
type AprobacionFiltro = (typeof APROBACION_FILTROS)[number];

export default function ComprasPorAprobar() {
  const { canAprobarFacturaProveedor } = usePermissions();
  const navigate = useNavigate();
  // M8 (Ola 8): pestaña y búsqueda viven en la URL (link compartible).
  const [aprobacion, setAprobacion] = useFiltroUrl<AprobacionFiltro>("estado", APROBACION_FILTROS, "pendiente");
  const [search, setSearch] = useTextoUrl("q");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { aprobar, isRunning, progreso } = useAprobarFacturasLote();
  const {
    verificar: verificarSat,
    isRunning: satRunning,
    progreso: satProgreso,
  } = useVerificarSatLote();


  const { data: rows = [], isLoading, isError, refetch } = useFacturasCxP({
    aprobacion,
    search: search || undefined,
  });

  // Contadores globales por estado (sin filtro de búsqueda) para los tabs/KPIs.
  const { data: pendientes = [] } = useFacturasCxP({ aprobacion: "pendiente" });
  const { data: aprobadas = [] } = useFacturasCxP({ aprobacion: "aprobada" });
  const { data: rechazadas = [] } = useFacturasCxP({ aprobacion: "rechazada" });

  const seleccionEnLote = canAprobarFacturaProveedor && aprobacion === "pendiente";
  const { columns } = useColumnasPorAprobar({ rows, selected, setSelected, seleccionEnLote });

  const currentTotalMxn = useMemo(() => sumaMxn(rows), [rows]);
  const currentTotalUsd = useMemo(() => sumaUsd(rows), [rows]);

  const seleccionadas = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const totalSelMxn = sumaMxn(seleccionadas);
  const totalSelUsd = sumaUsd(seleccionadas);

  // Sólo los CFDI (proveedor nacional, con UUID) se consultan en el SAT.
  // Las facturas extranjeras o de captura manual no dependen del SAT y se
  // aprueban normalmente: ver `requiereValidacionSat`.
  const validablesSat = useMemo(
    () => seleccionadas.filter((f) => esValidableEnSat(f)).map((f) => f.id),
    [seleccionadas],
  );


  const handleAprobarLote = async () => {
    await aprobar(Array.from(selected));
    setSelected(new Set());
    setConfirmOpen(false);
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Por aprobar"
        description="Solicitudes de aprobación de facturas de proveedor. Revisa, aprueba o rechaza cada solicitud."
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar la bandeja de aprobación"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ClipboardCheck}
          label="Pendientes"
          value={`${pendientes.length} ${pendientes.length === 1 ? "factura" : "facturas"}`}
          sublabel={`${formatCurrency(sumaMxn(pendientes), "MXN")} · ${formatCurrency(sumaUsd(pendientes), "USD")}`}
          variant="warning"
        />
        <KpiCard icon={CheckCircle2} label="Aprobadas" value={`${aprobadas.length} ${aprobadas.length === 1 ? "factura" : "facturas"}`} variant="success" />
        <KpiCard icon={XCircle} label="Rechazadas" value={`${rechazadas.length} ${rechazadas.length === 1 ? "factura" : "facturas"}`} variant="destructive" />
        <KpiCard
          icon={ClipboardCheck}
          label={`Total en vista (${aprobacion})`}
          value={`${rows.length} ${rows.length === 1 ? "factura" : "facturas"}`}
          sublabel={`${formatCurrency(currentTotalMxn, "MXN")} · ${formatCurrency(currentTotalUsd, "USD")}`}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs
            value={aprobacion}
            onValueChange={(v) => {
              setAprobacion(v as AprobacionFiltro);
              setSelected(new Set());
            }}
          >
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
          {seleccionEnLote && (
            <ComprasPorAprobarBulkBar
              selectedCount={selected.size}
              totalSelMxn={totalSelMxn}
              totalSelUsd={totalSelUsd}
              isRunning={isRunning}
              progreso={progreso}
              onOpenConfirm={() => setConfirmOpen(true)}
              validablesCount={validablesSat.length}
              satRunning={satRunning}
              satProgreso={satProgreso}
              onValidarSat={() => void verificarSat(validablesSat)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && rows.length === 0 ? (
            <ComprasPorAprobarEmptyState aprobacion={aprobacion} />
          ) : (
            <ResponsiveDataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="No hay facturas que coincidan con la búsqueda"
              rowKey={(f) => f.id}
              density={TABLE_DENSITY.embebida}
              initialSort={{ key: "vencimiento", dir: "asc" }}
              onRowClick={(fact) => navigate(`/compras/facturas/${fact.id}`)}
              mobileCard={(f) => <ComprasPorAprobarMobileCard row={f} />}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmarAprobacionLoteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        cantidad={selected.size}
        totalMxn={totalSelMxn}
        totalUsd={totalSelUsd}
        isRunning={isRunning}
        onConfirm={() => void handleAprobarLote()}
      />
      </CargaGuard>
    </PageContainer>
  );
}
