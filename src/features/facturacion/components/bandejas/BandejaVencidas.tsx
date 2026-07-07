/**
 * Bandeja "Vencidas": facturas con vencimiento pasado y saldo > 0.
 * Reusa `useCobranza`. Ordena por días de vencimiento (más vencido primero).
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

interface FilaVencida {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha_vencimiento: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

function toneDias(d: number): "outline" | "secondary" | "destructive" {
  if (d > 60) return "destructive";
  if (d > 30) return "secondary";
  return "outline";
}

export function BandejaVencidas() {
  const navigate = useNavigate();
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaVencida[]>(
    () =>
      (data ?? [])
        .filter((f) => f.saldo > 0 && f.estatus_cobranza === "Vencida")
        .slice()
        .sort((a, b) => b.dias_vencido - a.dias_vencido)
        .slice(0, 200),
    [data],
  );

  const columnas: ColumnaBandeja<FilaVencida>[] = [
    { key: "num", header: "Folio", cell: (r) => <span className="font-mono">{r.numero}</span> },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    { key: "fv", header: "Venció", cell: (r) => formatDate(r.fecha_vencimiento) },
    { key: "dv", header: "Días", cell: (r) => (
      <Badge variant={toneDias(r.dias_vencido)}>{r.dias_vencido} d</Badge>
    ) },
    { key: "sal", header: "Saldo", className: "text-right tabular-nums",
      cell: (r) => formatCurrency(r.saldo, r.moneda) },
  ];

  return (
    <TablaBandejaSimple<FilaVencida>
      columnas={columnas}
      data={filas}
      isLoading={isLoading}
      emptyMessage="Sin cartera vencida. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: "Cobrar",
        icon: <CreditCard className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => navigate(`/facturacion/${r.id}?accion=pagar`),
      }}
    />
  );
}
