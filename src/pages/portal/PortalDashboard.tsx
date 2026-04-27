import { Skeleton } from "@/components/ui/skeleton";

import {
  usePortalEmbarques,
  usePortalCotizaciones,
  usePortalFacturas,
  usePortalClientUsers,
  usePortalClienteName,
  usePortalOrgName,
} from "@/hooks/portal/usePortalData";
import { usePortalDashboardKpis } from "@/hooks/portal/usePortalDashboardKpis";

import { PortalWelcomeCard } from "@/components/portal/dashboard/PortalWelcomeCard";
import { PortalKpiGrid } from "@/components/portal/dashboard/PortalKpiGrid";
import { PortalEstadoEmbarquesCard } from "@/components/portal/dashboard/PortalEstadoEmbarquesCard";
import { PortalProximosArribosCard } from "@/components/portal/dashboard/PortalProximosArribosCard";
import { PortalFacturacionPendienteCard } from "@/components/portal/dashboard/PortalFacturacionPendienteCard";
import { PortalEmbarquesRecientesCard } from "@/components/portal/dashboard/PortalEmbarquesRecientesCard";

export default function PortalDashboard() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: embarques = [], isLoading: loadingEmb } = usePortalEmbarques(clienteIds);
  const { data: cotizaciones = [], isLoading: loadingCot } = usePortalCotizaciones(clienteIds);
  const { data: facturas = [], isLoading: loadingFac } = usePortalFacturas(clienteIds);

  const {
    embarquesActivos,
    facturasPendientes,
    proximosArribos,
    estadoDistribucion,
    montoFacturasPendientes,
    facturasVencidas,
  } = usePortalDashboardKpis(embarques, facturas);

  if (loadingEmb || loadingCot || loadingFac) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const hayFacturasPendientes = facturasPendientes.length > 0;

  return (
    <div className="space-y-6">
      <PortalWelcomeCard clienteName={clienteName} orgName={orgName} />

      <PortalKpiGrid
        values={{
          embarques: embarquesActivos.length,
          cotizaciones: cotizaciones.filter((c) => c.estado === "Enviada").length,
          facturas: facturasPendientes.length,
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
          monto={montoFacturasPendientes}
          total={facturasPendientes.length}
          vencidas={facturasVencidas}
          className="lg:col-span-1"
        />
        <PortalEmbarquesRecientesCard
          embarques={embarquesActivos}
          className={hayFacturasPendientes ? "lg:col-span-2" : "lg:col-span-3"}
        />
      </div>
    </div>
  );
}
