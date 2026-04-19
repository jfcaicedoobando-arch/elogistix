import { Ship, FileText, Users, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  embarques: number;
  cotizaciones: number;
  contactos: number;
  facturadoUSD: number;
  pendienteUSD: number;
  profitUSD: number;
}

export default function ClienteSummaryCards({ embarques, cotizaciones, contactos, facturadoUSD, pendienteUSD, profitUSD }: Props) {
  const items = [
    { label: "Embarques", value: String(embarques), icon: Ship, color: "bg-blue-50 text-blue-600" },
    { label: "Cotizaciones", value: String(cotizaciones), icon: FileText, color: "bg-violet-50 text-violet-600" },
    { label: "Contactos", value: String(contactos), icon: Users, color: "bg-emerald-50 text-emerald-600" },
    { label: "Facturado", value: formatCurrency(facturadoUSD, "USD"), icon: DollarSign, color: "bg-cyan-50 text-cyan-600", small: true },
    { label: "Pendiente", value: formatCurrency(pendienteUSD, "USD"), icon: AlertCircle, color: "bg-amber-50 text-amber-600", small: true },
    { label: "Profit", value: formatCurrency(profitUSD, "USD"), icon: TrendingUp, color: "bg-green-50 text-green-600", small: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${it.color}`}>
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
