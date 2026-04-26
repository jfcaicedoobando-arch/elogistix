import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";
import { DashboardStatusCards } from "@/components/dashboard/DashboardStatusCards";
import { AlertasDemoraCard } from "@/components/dashboard/AlertasDemoraCard";
import { ProximosArribosCard } from "@/components/dashboard/ProximosArribosCard";
import { ProfitTable } from "@/components/dashboard/ProfitTable";
import { EmbarquesActivosTable } from "@/components/dashboard/EmbarquesActivosTable";
import { CargasActivasClienteCard } from "@/components/dashboard/CargasActivasClienteCard";

function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function Dashboard() {
  const {
    isLoading,
    filtroEstado,
    setFiltroEstado,
    conteoPorEstado,
    totalActivos,
    alertasDemora,
    proximosArribos,
    profitArribosEsteMes,
    embarquesMesSiguiente,
    resumenMesSiguiente,
    arribosEsteMes,
    cargasPorCliente,
  } = useDashboardData();

  const { saludo, hoyStr } = useMemo(() => ({
    saludo: getSaludo(),
    hoyStr: new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {saludo} 👋
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{hoyStr}</p>
        </div>
        <Badge variant="secondary" className="text-xs w-fit">
          {totalActivos} embarques activos
        </Badge>
      </div>

      <DashboardStatusCards
        conteoPorEstado={conteoPorEstado}
        totalActivos={totalActivos}
        filtroEstado={filtroEstado}
        onFiltroChange={setFiltroEstado}
        isLoading={isLoading}
        arribosEsteMes={arribosEsteMes}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertasDemoraCard alertas={alertasDemora} isLoading={isLoading} />
        <ProximosArribosCard arribos={proximosArribos} isLoading={isLoading} />
      </div>

      <CargasActivasClienteCard data={cargasPorCliente} isLoading={isLoading} />

      <ProfitTable embarques={profitArribosEsteMes} isLoading={isLoading} />

      <EmbarquesActivosTable
        embarques={embarquesMesSiguiente}
        resumen={resumenMesSiguiente}
        isLoading={isLoading}
      />
    </div>
  );
}
