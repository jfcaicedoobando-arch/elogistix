/**
 * Bandeja "REP pendientes": pagos aplicados a facturas PPD cuyo
 * Complemento de Pagos (REP) no se ha timbrado (estado_rep en
 * 'Pendiente' o 'Error'). Acción rápida: abrir la factura padre.
 */
import { useNavigate } from "react-router-dom";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePagosRepPendientes, type FilaRepPendiente } from "@/features/facturacion/hooks/useBandejas";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

function badgeTone(estado: string): "outline" | "destructive" {
  return estado === "Error" ? "destructive" : "outline";
}

export function BandejaRepPendientes() {
  const navigate = useNavigate();
  const { data, isLoading } = usePagosRepPendientes();

  const columnas: ColumnaBandeja<FilaRepPendiente>[] = [
    { key: "fol", header: "Factura", cell: (r) => <span className="font-mono">{r.factura_numero}</span> },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    { key: "fp", header: "Fecha pago", cell: (r) => formatDate(r.fecha_pago) },
    { key: "mon", header: "Monto", className: "text-right tabular-nums",
      cell: (r) => formatCurrency(r.monto, r.moneda) },
    { key: "est", header: "Estado REP", cell: (r) => (
      <Badge variant={badgeTone(r.estado_rep)}>{r.estado_rep}</Badge>
    ) },
  ];

  return (
    <TablaBandejaSimple<FilaRepPendiente>
      columnas={columnas}
      data={data}
      isLoading={isLoading}
      emptyMessage="No hay complementos de pago pendientes. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: "Timbrar REP",
        icon: <Receipt className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => navigate(`/facturacion/${r.factura_id}?accion=timbrar-rep&pago=${r.id}`),
      }}
    />
  );
}
