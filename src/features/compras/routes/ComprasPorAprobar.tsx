/** Bandeja /compras/por-aprobar — Ola C: facturas bajo flujo de aprobación. */
import { useMemo, useState } from "react";
import { useFiltroUrl, useTextoUrl } from "@/hooks/shared";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import SearchInput from "@/components/shared/SearchInput";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP, useAprobarFacturasLote, useVerificarSatLote } from "@/features/cxp/hooks";
import { sumaMxn, sumaUsd } from "./ComprasPorAprobar.helpers";
import { ComprasPorAprobarKpis } from "./ComprasPorAprobar.kpis";
import { useColumnasPorAprobar } from "./ComprasPorAprobar.useColumnas";
import { ConfirmarAprobacionLoteDialog } from "./ComprasPorAprobar.confirmDialog";
import { ComprasPorAprobarEmptyState } from "./ComprasPorAprobar.emptyState";
import { ComprasPorAprobarBulkBar } from "./ComprasPorAprobar.bulkBar";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ComprasPorAprobarMobileRow } from "./ComprasPorAprobar.mobileCard";
import { useSeleccionEfectiva } from "./ComprasPorAprobar.seleccion";
const APROBACION_FILTROS = ["pendiente", "aprobada", "rechazada"] as const;
type AprobacionFiltro = (typeof APROBACION_FILTROS)[number];

export default function ComprasPorAprobar() {
  const { canAprobarFacturaProveedor } = usePermissions();
  const [aprobacion, setAprobacion] = useFiltroUrl<AprobacionFiltro>("estado", APROBACION_FILTROS, "pendiente");
  const [search, setSearch] = useTextoUrl("q");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // FP-000221: justificación única para las seleccionadas sin embarque.
  const [justificacionLote, setJustificacionLote] = useState("");
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
  const { columns, bloqueadosSod, motivoBloqueo } = useColumnasPorAprobar({ rows, selected, setSelected, seleccionEnLote });
  const currentTotalMxn = useMemo(() => sumaMxn(rows), [rows]);
  const currentTotalUsd = useMemo(() => sumaUsd(rows), [rows]);

  const seleccion = useSeleccionEfectiva(rows, selected, bloqueadosSod);

  const handleAprobarLote = async () => {
    if (seleccion.ids.length === 0) {
      setConfirmOpen(false);
      return;
    }
    await aprobar(seleccion.ids, {
      justificacion: justificacionLote,
      requierenJustificacion: seleccion.idsSinEmbarque,
    });
    setSelected(new Set());
    setJustificacionLote("");
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
      <ComprasPorAprobarKpis
        pendientes={pendientes}
        aprobadas={aprobadas}
        rechazadas={rechazadas}
        rows={rows}
        aprobacion={aprobacion}
        currentTotalMxn={currentTotalMxn}
        currentTotalUsd={currentTotalUsd}
      />


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
            onChange={(value) => {
              setSearch(value);
              setSelected(new Set());
              setJustificacionLote("");
              setConfirmOpen(false);
            }}
            placeholder="Buscar por folio, folio proveedor o proveedor…"
          />
          {seleccionEnLote && (
            <ComprasPorAprobarBulkBar
              selectedCount={seleccion.filas.length}
              totalSelMxn={seleccion.totalMxn}
              totalSelUsd={seleccion.totalUsd}
              isRunning={isRunning}
              progreso={progreso}
              onOpenConfirm={() => {
                if (seleccion.filas.length > 0) setConfirmOpen(true);
              }}
              validablesCount={seleccion.validablesSat.length}
              satRunning={satRunning}
              satProgreso={satProgreso}
              onValidarSat={() => {
                if (seleccion.validablesSat.length > 0) void verificarSat(seleccion.validablesSat);
              }}
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
              getRowHref={(fact) => `/compras/facturas/${fact.id}`}
              getRowAriaLabel={(fact) => `Abrir factura ${fact.folio_proveedor || fact.folio_interno || "sin folio"}`}
              mobileCard={(f) => (
                <ComprasPorAprobarMobileRow
                  row={f}
                  seleccionEnLote={seleccionEnLote}
                  selected={selected}
                  setSelected={setSelected}
                  bloqueadosSod={bloqueadosSod}
                  motivoBloqueo={motivoBloqueo}
                />
              )}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmarAprobacionLoteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        cantidad={seleccion.filas.length}
        totalMxn={seleccion.totalMxn}
        totalUsd={seleccion.totalUsd}
        isRunning={isRunning}
        requierenJustificacion={seleccion.idsSinEmbarque.size}
        justificacion={justificacionLote}
        onJustificacionChange={setJustificacionLote}
        onConfirm={() => void handleAprobarLote()}
      />
      </CargaGuard>
    </PageContainer>
  );
}
