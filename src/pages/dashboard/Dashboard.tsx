import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardStatusCards } from "@/features/dashboard/components/DashboardStatusCards";
import { AlertasDemoraCard } from "@/features/dashboard/components/AlertasDemoraCard";
import { ProximosArribosCard } from "@/features/dashboard/components/ProximosArribosCard";
import { ProfitTable } from "@/features/dashboard/components/ProfitTable";
import { EmbarquesActivosTable } from "@/features/dashboard/components/EmbarquesActivosTable";
import { CargasActivasClienteCard } from "@/features/dashboard/components/CargasActivasClienteCard";
import { MiOperacionSection } from "@/features/dashboard/components/operador/MiOperacionSection";
import { useDashboardController, type DashboardScope } from "@/features/dashboard/hooks/useDashboardController";

export default function Dashboard() {
  const {
    scope, setScope, showScopeToggle, operadorEmail,
    isOperador, canViewFinancials, hideFinancials, isLoading,
    cargasPorCliente, cargasActivasTotal, scoped, saludo, hoyStr,
  } = useDashboardController();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={`${saludo} 👋`}
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
    </div>
  );
}
