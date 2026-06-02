import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useDashboardData, ESTADOS_FILTRO } from "@/hooks/dashboard";
import { DashboardStatusCards } from "@/components/dashboard/DashboardStatusCards";
import { AlertasDemoraCard } from "@/components/dashboard/AlertasDemoraCard";
import { ProximosArribosCard } from "@/components/dashboard/ProximosArribosCard";
import { ProfitTable } from "@/components/dashboard/ProfitTable";
import { EmbarquesActivosTable } from "@/components/dashboard/EmbarquesActivosTable";
import { CargasActivasClienteCard } from "@/components/dashboard/CargasActivasClienteCard";
import { MiOperacionSection } from "@/components/dashboard/operador/MiOperacionSection";

function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

type Scope = "todos" | "mios";

export default function Dashboard() {
  const { user } = useAuth();
  const { isOperador, canViewFinancials } = usePermissions();
  const [scope, setScope] = useState<Scope>("todos");

  const {
    isLoading,
    conteoPorEstado,
    totalActivos,
    alertasDemora,
    proximosArribos,
    profitArribosEsteMes,
    embarquesMesSiguiente,
    resumenMesSiguiente,
    arribosEsteMes,
    cargasPorCliente,
    cargasActivasTotal,
  } = useDashboardData();

  const operadorEmail = user?.email ?? "";

  // Filtrado por scope=mios — match por embarque.operador === user.email (case-insensitive)
  const scoped = useMemo(() => {
    if (scope === "todos") {
      return {
        alertasDemora,
        proximosArribos,
        profitArribosEsteMes,
        embarquesMesSiguiente,
        conteoPorEstado,
        totalActivos,
        arribosEsteMes,
        resumenMesSiguiente,
      };
    }
    const mine = (op: string | null | undefined) =>
      (op ?? "").toLowerCase() === operadorEmail.toLowerCase();

    const ad = alertasDemora.filter((e) => mine(e.operador));
    const pa = proximosArribos.filter((e) => mine(e.operador));
    const pf = profitArribosEsteMes.filter((e) => mine(e.operador));
    const em = embarquesMesSiguiente.filter((e) => mine(e.operador));

    // Recalcular conteoPorEstado desde activos del operador
    const activos = [...ad, ...pa, ...pf, ...em];
    const seen = new Set<string>();
    const conteo: Record<string, number> = Object.fromEntries(ESTADOS_FILTRO.map((e) => [e, 0]));
    for (const e of activos) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (e.estadoReal in conteo) conteo[e.estadoReal] += 1;
    }
    const total = seen.size;

    // Recalcular arribos del mes desde profitArribosEsteMes filtrado
    const arribosScoped = {
      ...arribosEsteMes,
      total: pf.length,
      yaLlegaron: pf.filter((e) => ["Arribo", "En Aduana", "Entregado"].includes(e.estadoReal)).length,
      enCamino: pf.filter((e) => !["Arribo", "En Aduana", "Entregado"].includes(e.estadoReal)).length,
    };

    // Recalcular resumen del mes siguiente desde embarquesMesSiguiente filtrado
    const resumenScoped = {
      ...resumenMesSiguiente,
      totalEmbarques: em.length,
      facturados: em.filter((e) => e.facturado).length,
    };

    return {
      alertasDemora: ad,
      proximosArribos: pa,
      profitArribosEsteMes: pf,
      embarquesMesSiguiente: em,
      conteoPorEstado: conteo as typeof conteoPorEstado,
      totalActivos: total,
      arribosEsteMes: arribosScoped,
      resumenMesSiguiente: resumenScoped,
    };
  }, [
    scope, operadorEmail,
    alertasDemora, proximosArribos, profitArribosEsteMes, embarquesMesSiguiente,
    conteoPorEstado, totalActivos, arribosEsteMes, resumenMesSiguiente,
  ]);

  const { saludo, hoyStr } = useMemo(() => {
    const fecha = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return {
      saludo: getSaludo(),
      hoyStr: fecha.charAt(0).toUpperCase() + fecha.slice(1),
    };
  }, []);

  const hideFinancials = !canViewFinancials;

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

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="mios" disabled={!operadorEmail}>Míos</TabsTrigger>
        </TabsList>
      </Tabs>

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
