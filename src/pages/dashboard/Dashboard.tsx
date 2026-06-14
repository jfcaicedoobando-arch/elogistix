import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardStatusCards } from "@/components/dashboard/DashboardStatusCards";
import { AlertasDemoraCard } from "@/components/dashboard/AlertasDemoraCard";
import { ProximosArribosCard } from "@/components/dashboard/ProximosArribosCard";
import { ProfitTable } from "@/components/dashboard/ProfitTable";
import { EmbarquesActivosTable } from "@/components/dashboard/EmbarquesActivosTable";
import { CargasActivasClienteCard } from "@/components/dashboard/CargasActivasClienteCard";
import { MiOperacionSection } from "@/components/dashboard/operador/MiOperacionSection";
import { useDashboardController, type DashboardScope } from "@/features/dashboard/hooks/useDashboardController";

export default function Dashboard() {
  const {
    scope, setScope, showScopeToggle, operadorEmail,
    isOperador, canViewFinancials, hideFinancials, isLoading,
    cargasPorCliente, cargasActivasTotal, scoped, saludo, hoyStr,
  } = useDashboardController();

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
