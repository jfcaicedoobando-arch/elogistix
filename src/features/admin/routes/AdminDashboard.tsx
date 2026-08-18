import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Building2, Users, ArrowRight, BarChart3, Building } from "lucide-react";
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
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

const AdminDashboardActivityChart = lazy(
  () => import("@/features/admin/components/AdminDashboardActivityChart"),
);

export default function AdminDashboard() {
  useDocumentTitle('Dashboard Super Admin');
  const navigate = useNavigate();
  const { data: stats, isLoading, isError: errorStats, refetch: refetchStats } = useAdminDashboardStats();
  const { data: activity = [], isLoading: loadingActivity, isError: errorActivity, refetch: refetchActivity } = useAdminOrgActivity();
  const { data: recentOrgs = [], isLoading: loadingRecent, isError: errorRecent, refetch: refetchRecent } = useAdminRecentOrgs(5);

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

      {(errorStats || errorActivity || errorRecent) && (
        <ErrorState
          className="mb-4"
          onRetry={() => {
            void refetchStats();
            void refetchActivity();
            void refetchRecent();
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <KpiCard
            key={card.title}
            label={card.title}
            value={isLoading ? "—" : card.value}
            icon={card.icon}
            to={card.navigable && card.to ? card.to : undefined}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Actividad por organización</CardTitle>
            <CardDescription>Embarques y cotizaciones acumulados</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="h-[260px] flex items-center justify-center">
                <ChartSkeleton height={260} />
              </div>
            ) : activity.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <EmptyStateInline icon={BarChart3} message="Sin datos disponibles." />
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
            <CardTitle>Últimas organizaciones</CardTitle>
            <CardDescription>Creadas recientemente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingRecent ? (
              <ListSkeleton rows={4} />
            ) : recentOrgs.length === 0 ? (
              <EmptyStateInline icon={Building} message="Aún no hay organizaciones." className="py-6" />
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
