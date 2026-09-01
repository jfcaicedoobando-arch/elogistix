import { PortalPageShell } from "@/features/portal/components/layout/PortalPageShell";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { SolicitarCotizacionDialog } from "@/features/portal/components/SolicitarCotizacionDialog";

import {
  usePortalEmbarques,
  usePortalCotizaciones,
  usePortalClientUsers,
  usePortalClienteName,
  usePortalContactoNombre,
  usePortalOrgName,
} from "@/features/portal/hooks";
import { usePortalDashboardKpis } from "@/features/portal/hooks";
import { useEstadoCuenta } from "@/features/facturacion/estadoCuenta/hooks/useEstadoCuenta";

import { PortalWelcomeCard } from "@/features/portal/components/dashboard/PortalWelcomeCard";
import { PortalKpiGrid } from "@/features/portal/components/dashboard/PortalKpiGrid";
import { PortalEstadoEmbarquesCard } from "@/features/portal/components/dashboard/PortalEstadoEmbarquesCard";
import { PortalProximosArribosCard } from "@/features/portal/components/dashboard/PortalProximosArribosCard";
import { PortalFacturacionPendienteCard } from "@/features/portal/components/dashboard/PortalFacturacionPendienteCard";
import { PortalEmbarquesRecientesCard } from "@/features/portal/components/dashboard/PortalEmbarquesRecientesCard";
import { useDocumentTitle } from "@/hooks/shared";
import { opcionesSolicitante } from "@/features/portal/domain/clientesSolicitantes";
import { ErrorState } from "@/components/shared/states/ErrorState";

export default function PortalDashboard() {
  useDocumentTitle('Portal');
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);
  const { data: clientUsers = [] } = usePortalClientUsers();
  const { data: clienteName } = usePortalClienteName();
  const { data: contactoName } = usePortalContactoNombre();
  const { data: orgName } = usePortalOrgName();
  // Opciones autorizadas con nombre legible: la solicitud ya no se atribuye
  // en silencio al primer cliente del usuario.
  const clientes = useMemo(() => opcionesSolicitante(clientUsers), [clientUsers]);
  const clienteIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const { data: embarques = [], isLoading: loadingEmb, isError: errorEmb, refetch: refetchEmb } = usePortalEmbarques(clienteIds);
  const { data: cotizaciones = [], isLoading: loadingCot, isError: errorCot, refetch: refetchCot } = usePortalCotizaciones(clienteIds);
  // B-068/B-076: la tarjeta de Facturación Pendiente se alimenta del MISMO
  // agregado que el estado de cuenta del portal — saldo real por moneda
  // (incluye Parcialmente pagada y resta pagos + notas de crédito).
  const { kpis: kpisCobranza, isLoading: loadingFac, isError: errorFac, refetch: refetchFac } = useEstadoCuenta({
    clienteIds,
    soloConSaldo: true,
  });

  const {
    embarquesActivos,
    proximosArribos,
    estadoDistribucion,
  } = usePortalDashboardKpis(embarques);

  const cargando = loadingEmb || loadingCot || loadingFac;

  return (
    <PortalPageShell>
      {(errorEmb || errorCot || errorFac) && (
        <ErrorState
          className="mb-2"
          onRetry={() => {
            void refetchEmb();
            void refetchCot();
            void refetchFac();
          }}
        />
      )}
      {/* UI-4: el saludo y el acceso a "Solicitar cotización" se pintan desde el
          primer frame; sólo el cuerpo de datos se sustituye por el esqueleto. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          {/* Con varias empresas no se afirma el nombre de una sola. */}
          <PortalWelcomeCard clienteName={clientes.length === 1 ? clienteName : null} contactoName={contactoName} orgName={orgName} />
        </div>
        <Button className="sm:self-stretch" onClick={() => setSolicitudAbierta(true)}>
          <Plus className="h-4 w-4 mr-1" aria-hidden /> Solicitar cotización
        </Button>
      </div>


      <SolicitarCotizacionDialog
        open={solicitudAbierta}
        onOpenChange={setSolicitudAbierta}
        clientes={clientes}
      />

      {cargando ? (
        <DashboardSkeleton kpis={3} charts={2} />
      ) : (
        <>
          <PortalKpiGrid
            values={{
              embarques: embarquesActivos.length,
              cotizaciones: cotizaciones.filter((c) => c.estado === "Enviada").length,
              facturas: kpisCobranza.facturasAdeudadas,
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PortalEstadoEmbarquesCard
              total={embarquesActivos.length}
              distribucion={estadoDistribucion}
            />
            <PortalProximosArribosCard items={proximosArribos} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PortalFacturacionPendienteCard
              montos={kpisCobranza.adeudado}
              total={kpisCobranza.facturasAdeudadas}
              vencidas={kpisCobranza.facturasVencidas}
              className="lg:col-span-1"
            />
            <PortalEmbarquesRecientesCard
              embarques={embarquesActivos}
              className="lg:col-span-2"
            />
          </div>
        </>
      )}

    </PortalPageShell>
  );
}
