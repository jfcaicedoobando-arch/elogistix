import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Ship, FileText } from "lucide-react";
import { useAdminDashboardStats } from "@/hooks/admin/useAdminData";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminDashboardStats();

  const cards = [
    { title: "Organizaciones", value: stats?.totalOrgs ?? 0, icon: Building2, color: "text-primary" },
    { title: "Usuarios", value: stats?.totalUsers ?? 0, icon: Users, color: "text-info" },
    { title: "Embarques", value: stats?.totalEmbarques ?? 0, icon: Ship, color: "text-accent-foreground" },
    { title: "Cotizaciones", value: stats?.totalCotizaciones ?? 0, icon: FileText, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Super Admin</h1>
        <p className="text-sm text-muted-foreground">Resumen global de todas las organizaciones.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
