import { Ship, FileText, Users, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { kpiIconChipClasses, type KpiTone } from "@/lib/ui/kpiTones";

interface Props {
  embarques: number;
  cotizaciones: number;
  contactos: number;
  facturadoUSD: number;
  pendienteUSD: number;
  profitUSD: number;
}

export default function ClienteSummaryCards({ embarques, cotizaciones, contactos, facturadoUSD, pendienteUSD, profitUSD }: Props) {
  const items: Array<{ label: string; value: string; icon: React.ElementType; tone: KpiTone; small?: boolean }> = [
    { label: "Embarques", value: String(embarques), icon: Ship, tone: "info" },
    { label: "Cotizaciones", value: String(cotizaciones), icon: FileText, tone: "accent" },
    { label: "Contactos", value: String(contactos), icon: Users, tone: "success" },
    { label: "Facturado", value: formatCurrency(facturadoUSD, "USD"), icon: DollarSign, tone: "secondary", small: true },
    { label: "Pendiente", value: formatCurrency(pendienteUSD, "USD"), icon: AlertCircle, tone: "warning", small: true },
    { label: "Profit", value: formatCurrency(profitUSD, "USD"), icon: TrendingUp, tone: "success", small: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${kpiIconChipClasses(it.tone)}`}>
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className={it.small ? "text-lg font-bold" : "text-xl font-bold"}>{it.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
