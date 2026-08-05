/**
 * /crm/mi-dia — Vista 100% accionable: "qué tengo que hacer hoy".
 * Sin KPIs ni gráficas (esos viven en /crm Resumen ejecutivo).
 * Dos secciones: Hoy (NBA + actividades) y Esta semana (deals + cots + leads).
 */
import { useCrmInicioVM } from "@/features/crm/hooks";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { ActividadesHoyCard } from "@/features/crm/components/crmDashboard/ActividadesHoyCard";
import { CerrandoSemanaCard, LeadsSinContactarCard } from "@/features/crm/components/crmDashboard/DealsCards";
import { NextBestActionsCard } from "@/features/crm/components/crmDashboard/NextBestActionsCard";
import { CotizacionesSinRespuestaCard } from "@/features/crm/components/crmDashboard/CotizacionesSinRespuestaCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatFechaLarga } from "@/lib/formatters/dates";
import { useDocumentTitle } from "@/hooks/shared";
import { SectionHeading } from "@/components/shared/SectionHeading";

export default function MiDia() {
  useDocumentTitle('Mi día');
  const vm = useCrmInicioVM();
  const hoy = formatFechaLarga(new Date(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <PageContainer>
      <PageHeader
        title="Mi día"
        description="Actividades y seguimientos pendientes para hoy"
      />
      <CrmSubheader context={`Mi día · ${hoy}`} />

      <section className="space-y-3">
        <SectionHeading variant="overline">Hoy</SectionHeading>
        <NextBestActionsCard items={vm.nba} isLoading={vm.nbaLoading} />
        <ActividadesHoyCard items={vm.actividadesHoy} />
      </section>

      <section className="space-y-3">
        <SectionHeading variant="overline">Esta semana</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CerrandoSemanaCard items={vm.cerrandoSemana} />
          <CotizacionesSinRespuestaCard items={vm.cotsSinResp} />
          <LeadsSinContactarCard items={vm.leadsSinContactar} />
        </div>
      </section>
    </PageContainer>
  );
}
