/**
 * Bandeja "Por cobrar": facturas vigentes con saldo > 0, no vencidas.
 * Reusa `useCobranza`. Acción rápida: registrar pago (en el detalle).
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

interface FilaCobranza {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha_vencimiento: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

export function BandejaPorCobrar() {
  const navigate = useNavigate();
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaCobranza[]>(
    () =>
      (data ?? [])
        .filter((f) => f.saldo > 0 && f.estatus_cobranza !== "Vencida")
        .slice()
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
        .slice(0, 200),
    [data],
  );

  const columnas: ColumnaBandeja<FilaCobranza>[] = [
    { key: "num", header: "Folio", cell: (r) => <span className="font-mono">{r.numero}</span> },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    { key: "fv", header: "Vence", cell: (r) => formatDate(r.fecha_vencimiento) },
    { key: "sal", header: "Saldo", className: "text-right tabular-nums",
      cell: (r) => formatCurrency(r.saldo, r.moneda) },
  ];

  return (
    <TablaBandejaSimple<FilaCobranza>
      columnas={columnas}
      data={filas}
      isLoading={isLoading}
      emptyMessage="Sin saldos por cobrar. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: "Registrar pago",
        icon: <CreditCard className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => navigate(`/facturacion/${r.id}?accion=pagar`),
      }}
    />
  );
}
