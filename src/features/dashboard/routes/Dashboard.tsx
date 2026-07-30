"use memo";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardStatusCards } from "@/features/dashboard/components/DashboardStatusCards";
import { AlertasDemoraCard } from "@/features/dashboard/components/AlertasDemoraCard";
import { ProximosArribosCard } from "@/features/dashboard/components/ProximosArribosCard";
import { ProfitTable } from "@/features/dashboard/components/ProfitTable";
import { EmbarquesActivosTable } from "@/features/dashboard/components/EmbarquesActivosTable";
import { CargasActivasClienteCard } from "@/features/dashboard/components/CargasActivasClienteCard";
import { MiOperacionSection } from "@/features/dashboard/components/operador/MiOperacionSection";
import { useDashboardController, type DashboardScope } from "@/features/dashboard/hooks/useDashboardController";
import { useMisCotizacionesPendientesReaprobacion } from "@/features/cotizacion/hooks/usePendientesReaprobacion";
import { useAuth } from "@/lib/contexts/AuthContext";
import { FinanceDashboard } from "@/features/dashboard/finance/FinanceDashboard";
import { PageContainer } from "@/components/shared/PageContainer";

const ROLES_FINANCIEROS = new Set([
  "contador",
  "tesorero",
  "ejecutivo_cobranza",
  "auxiliar_contable",
]);

export default function Dashboard() {
  const { effectiveRole } = useAuth();
  if (effectiveRole && ROLES_FINANCIEROS.has(effectiveRole)) {
    return <FinanceDashboard />;
  }
  return <OperationalDashboard />;
}

function OperationalDashboard() {
  const {
    scope, setScope, showScopeToggle, operadorEmail,
    isOperador, canViewFinancials, hideFinancials, isLoading,
    cargasPorCliente, cargasActivasTotal, scoped, saludo, hoyStr,
  } = useDashboardController();
  const { data: misReaprob = 0 } = useMisCotizacionesPendientesReaprobacion();


  return (
    <PageContainer>
      <Seo title="Inicio · Libre Carga" description="Resumen operativo y comercial de tus embarques." />
      <PageHeader

        title={
          <>
            {saludo}{" "}
            <span role="img" aria-label="saludo" className="font-emoji">👋</span>
          </>
        }
        description={hoyStr}
        actions={
          <Badge variant="secondary" className="text-xs w-fit">
            {scoped.totalActivos} embarques activos
          </Badge>
        }
      />

      {showScopeToggle && (
        <Tabs value={scope} onValueChange={(v) => setScope(v as DashboardScope)}>
          <TabsList>
            <TabsTrigger value="mios" disabled={!operadorEmail}>Míos</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {misReaprob > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tienes {misReaprob} cotización{misReaprob === 1 ? "" : "es"} esperando tu re-aprobación</AlertTitle>
          <AlertDescription>
            Operaciones detectó cambios en la tarifa al crear el embarque.{" "}
            <Link to="/cotizaciones?reaprobacion=pendiente" className="underline font-medium">Revisar ahora →</Link>
          </AlertDescription>
        </Alert>
      )}

      {isOperador && (
        <MiOperacionSection
          alertasDemora={scoped.alertasDemora}
          proximosArribos={scoped.proximosArribos}
          isLoading={isLoading}
        />
      )}



      <DashboardStatusCards
        conteoPorEstado={scoped.conteoPorEstado}
        totalActivos={scoped.totalActivos}
        isLoading={isLoading}
        arribosEsteMes={scoped.arribosEsteMes}
        hideFinancials={hideFinancials}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <AlertasDemoraCard alertas={scoped.alertasDemora} isLoading={isLoading} />
        <ProximosArribosCard arribos={scoped.proximosArribos} isLoading={isLoading} />
      </div>

      {scope === "todos" && (
        <CargasActivasClienteCard
          data={cargasPorCliente}
          isLoading={isLoading}
          totalActivosGlobal={cargasActivasTotal}
        />
      )}

      {canViewFinancials && (
        <ProfitTable embarques={scoped.profitArribosEsteMes} isLoading={isLoading} />
      )}

      <EmbarquesActivosTable
        embarques={scoped.embarquesMesSiguiente}
        resumen={scoped.resumenMesSiguiente}
        isLoading={isLoading}
        hideFinancials={hideFinancials}
      />
    </PageContainer>
  );
}
