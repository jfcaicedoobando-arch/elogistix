import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Ship, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OrgStats {
  totalOrgs: number;
  totalUsers: number;
  totalEmbarques: number;
  totalCotizaciones: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<OrgStats>({
    totalOrgs: 0,
    totalUsers: 0,
    totalEmbarques: 0,
    totalCotizaciones: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [orgs, members, embarques, cotizaciones] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("organization_members").select("id", { count: "exact", head: true }),
        supabase.from("embarques").select("id", { count: "exact", head: true }),
        supabase.from("cotizaciones").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        totalOrgs: orgs.count ?? 0,
        totalUsers: members.count ?? 0,
        totalEmbarques: embarques.count ?? 0,
        totalCotizaciones: cotizaciones.count ?? 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const cards = [
    { title: "Organizaciones", value: stats.totalOrgs, icon: Building2, color: "text-primary" },
    { title: "Usuarios", value: stats.totalUsers, icon: Users, color: "text-info" },
    { title: "Embarques", value: stats.totalEmbarques, icon: Ship, color: "text-accent-foreground" },
    { title: "Cotizaciones", value: stats.totalCotizaciones, icon: FileText, color: "text-muted-foreground" },
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
                {loading ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
