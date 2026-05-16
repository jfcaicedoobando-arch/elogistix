import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
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

  const { saludo, hoyStr } = useMemo(() => {
    const fecha = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // Capitalizar solo la primera letra (preservar "de" en minúsculas)
    return {
      saludo: getSaludo(),
      hoyStr: fecha.charAt(0).toUpperCase() + fecha.slice(1),
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`${saludo} 👋`}
        description={hoyStr}
        actions={
          <Badge variant="secondary" className="text-xs w-fit">
            {totalActivos} embarques activos
          </Badge>
        }
      />

      <DashboardStatusCards
        conteoPorEstado={conteoPorEstado}
        totalActivos={totalActivos}
        isLoading={isLoading}
        arribosEsteMes={arribosEsteMes}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertasDemoraCard alertas={alertasDemora} isLoading={isLoading} />
        <ProximosArribosCard arribos={proximosArribos} isLoading={isLoading} />
      </div>

      <CargasActivasClienteCard data={cargasPorCliente} isLoading={isLoading} totalActivosGlobal={cargasActivasTotal} />

      <ProfitTable embarques={profitArribosEsteMes} isLoading={isLoading} />

      <EmbarquesActivosTable
        embarques={embarquesMesSiguiente}
        resumen={resumenMesSiguiente}
        isLoading={isLoading}
      />
    </div>
  );
}
