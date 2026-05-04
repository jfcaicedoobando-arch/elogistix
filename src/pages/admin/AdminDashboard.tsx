import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Ship, FileText, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  useAdminDashboardStats,
  useAdminOrgActivity,
  useAdminRecentOrgs,
} from "@/hooks/admin/useAdminData";
import { formatDate } from "@/lib/formatters";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useAdminDashboardStats();
  const { data: activity = [], isLoading: loadingActivity } = useAdminOrgActivity();
  const { data: recentOrgs = [], isLoading: loadingRecent } = useAdminRecentOrgs(5);

  const cards = [
    {
      title: "Organizaciones",
      value: stats?.totalOrgs ?? 0,
      icon: Building2,
      to: "/admin/organizaciones",
      tone: "text-primary",
    },
    {
      title: "Usuarios",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      to: "/admin/usuarios",
      tone: "text-info",
    },
    {
      title: "Embarques",
      value: stats?.totalEmbarques ?? 0,
      icon: Ship,
      to: "/admin/organizaciones",
      tone: "text-accent-foreground",
    },
    {
      title: "Cotizaciones",
      value: stats?.totalCotizaciones ?? 0,
      icon: FileText,
      to: "/admin/organizaciones",
      tone: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Super Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen global de toda la plataforma.
        </p>
      </div>

      {/* KPI Cards (clickables) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => navigate(card.to)}
            className="text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            aria-label={`Ver ${card.title}`}
          >
            <Card className="transition-all group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {isLoading ? "—" : card.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver detalle <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Activity chart */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actividad por organización</CardTitle>
            <CardDescription>Embarques y cotizaciones acumulados</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <Skeleton className="h-[260px] w-full" />
            ) : activity.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Sin datos disponibles.
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="embarques" name="Embarques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cotizaciones" name="Cotizaciones" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay organizaciones.</p>
            ) : (
              recentOrgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/admin/organizaciones/${o.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{o.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.plan} · {formatDate(o.created_at)}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
