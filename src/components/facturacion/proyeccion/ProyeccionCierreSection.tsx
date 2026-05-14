import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { getProfitToneClass } from "@/lib/ui/uiMappings";
import { CierreCard } from "../CierreCard";

interface Kpis {
  facturados: number;
  totalExpedientes: number;
  avancePct: number;
  ventaFacturadaUsd: number;
  ventaFacturadaMxn: number;
  pendientes: number;
  ventaPendienteUsd: number;
  ventaPendienteMxn: number;
  ventaProyUsd: number;
  ventaProyMxn: number;
  costoTotalMxn: number;
  margenProyPct: number;
  profitProyMxn: number;
}

interface Props {
  k: Kpis;
  mesLabel: string;
}

export function ProyeccionCierreSection({ k, mesLabel }: Props) {
  const profitTone = getProfitToneClass(k.margenProyPct);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
            Cierre {mesLabel}
          </h3>
          <Badge variant="outline" className="font-mono text-xs">
            {k.facturados}/{k.totalExpedientes} facturados · {k.avancePct.toFixed(0)}%
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <CierreCard
            tone="success"
            icon={CheckCircle2}
            titulo="✓ Facturado"
            embarques={k.facturados}
            lineas={[
              { label: "USD", value: formatCurrency(k.ventaFacturadaUsd, "USD"), emphasis: true },
              { label: "MXN", value: formatCurrency(k.ventaFacturadaMxn, "MXN"), emphasis: true },
            ]}
          />
          <CierreCard
            tone="warning"
            icon={Clock}
            titulo="⏳ Pendiente de facturar"
            embarques={k.pendientes}
            lineas={[
              { label: "USD", value: formatCurrency(k.ventaPendienteUsd, "USD"), emphasis: true },
              { label: "MXN", value: formatCurrency(k.ventaPendienteMxn, "MXN"), emphasis: true },
            ]}
          />
          <CierreCard
            tone="info"
            icon={TrendingUp}
            titulo="📈 Proyectado (total del mes)"
            embarques={k.totalExpedientes}
            lineas={[
              { label: "Venta USD", value: formatCurrency(k.ventaProyUsd, "USD") },
              { label: "Venta MXN", value: formatCurrency(k.ventaProyMxn, "MXN") },
              { label: "Costo MXN", value: formatCurrency(k.costoTotalMxn, "MXN"), className: "text-muted-foreground" },
              {
                label: `Profit (${k.margenProyPct.toFixed(1)}%)`,
                value: formatCurrency(k.profitProyMxn, "MXN"),
                emphasis: true,
                className: profitTone,
              },
            ]}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Avance de facturación</span>
            <span className="tabular-nums font-medium">{k.avancePct.toFixed(0)}%</span>
          </div>
          <Progress value={k.avancePct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
