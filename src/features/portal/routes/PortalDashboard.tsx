import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { SolicitarCotizacionDialog } from "@/features/portal/components/SolicitarCotizacionDialog";

import {
  usePortalEmbarques,
  usePortalCotizaciones,
  usePortalClientUsers,
  usePortalClienteName,
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

export default function PortalDashboard() {
  useDocumentTitle('Portal');
  const [solicitudAbierta, setSolicitudAbierta] = useState(false);
  const { data: clientUsers = [] } = usePortalClientUsers();
  const { data: clienteName } = usePortalClienteName();
  const { data: orgName } = usePortalOrgName();
  const clienteIds = clientUsers.map((cu) => cu.cliente_id);
  const { data: embarques = [], isLoading: loadingEmb } = usePortalEmbarques(clienteIds);
  const { data: cotizaciones = [], isLoading: loadingCot } = usePortalCotizaciones(clienteIds);
  // B-068/B-076: la tarjeta de Facturación Pendiente se alimenta del MISMO
  // agregado que el estado de cuenta del portal — saldo real por moneda
  // (incluye Parcialmente pagada y resta pagos + notas de crédito).
  const { kpis: kpisCobranza, isLoading: loadingFac } = useEstadoCuenta({
    clienteIds,
    soloConSaldo: true,
  });

  const {
    embarquesActivos,
    proximosArribos,
    estadoDistribucion,
  } = usePortalDashboardKpis(embarques);

  if (loadingEmb || loadingCot || loadingFac) {
    return <DashboardSkeleton kpis={3} charts={2} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <PortalWelcomeCard clienteName={clienteName} orgName={orgName} />
        </div>
        <Button className="sm:self-stretch" onClick={() => setSolicitudAbierta(true)}>
          <Plus className="h-4 w-4 mr-1" aria-hidden /> Solicitar cotización
        </Button>
      </div>

      <SolicitarCotizacionDialog
        open={solicitudAbierta}
        onOpenChange={setSolicitudAbierta}
        clienteId={clienteIds[0]}
        clienteIds={clienteIds}
      />

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
    </div>
  );
}
