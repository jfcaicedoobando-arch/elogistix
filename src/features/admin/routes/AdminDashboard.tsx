import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import {
  useAdminDashboardStats,
  useAdminOrgActivity,
  useAdminRecentOrgs,
} from "@/features/admin/hooks";
import { formatDate } from "@/lib/formatters";
import { useDocumentTitle } from "@/hooks/shared";

const AdminDashboardActivityChart = lazy(
  () => import("@/features/admin/components/AdminDashboardActivityChart"),
);

export default function AdminDashboard() {
  useDocumentTitle('Dashboard Super Admin');
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAdminDashboardStats();
  const { data: activity = [], isLoading: loadingActivity } = useAdminOrgActivity();
  const { data: recentOrgs = [], isLoading: loadingRecent } = useAdminRecentOrgs(5);

  const cards = [
    { title: "Organizaciones", value: stats?.totalOrgs ?? 0, icon: Building2, to: "/admin/organizaciones", tone: "text-primary", navigable: true },
    { title: "Miembros en la plataforma", value: stats?.totalUsers ?? 0, icon: Users, to: null, tone: "text-info", navigable: false },
  ] as const;

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Super Admin"
        description="Resumen global de toda la plataforma."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const inner = (
            <Card className="transition-all group-hover:shadow-raised group-hover:-translate-y-0.5 group-hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{isLoading ? "—" : card.value}</div>
                {card.navigable && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver detalle <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
          return card.navigable && card.to ? (
            <button key={card.title} onClick={() => navigate(card.to!)}
              className="text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              aria-label={`Ver ${card.title}`}
            >{inner}</button>
          ) : (
            <div key={card.title} className="group">{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actividad por organización</CardTitle>
            <CardDescription>Embarques y cotizaciones acumulados</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="h-[260px] flex items-center justify-center">
                <ChartSkeleton height={260} />
              </div>
            ) : activity.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Sin datos disponibles.
              </div>
            ) : (
              <Suspense fallback={<ChartSkeleton height={260} />}>
                <AdminDashboardActivityChart data={activity} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas organizaciones</CardTitle>
            <CardDescription>Creadas recientemente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingRecent ? (
              <ListSkeleton rows={4} />
            ) : recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay organizaciones.</p>
            ) : (
              recentOrgs.map((o) => (
                <button key={o.id} onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{o.nombre}</div>
                    <div className="text-xs text-muted-foreground">{o.plan} · {formatDate(o.created_at)}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
