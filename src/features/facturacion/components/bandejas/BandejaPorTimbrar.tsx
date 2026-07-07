/**
 * Bandeja "Por timbrar": borradores creados en el sistema
 * (post 01/07/2026) que aún no se han enviado a FacturApi.
 * Acción rápida: abrir el detalle donde vive el flujo de timbrado.
 */
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFacturasPorTimbrar, type FilaPorTimbrar } from "@/features/facturacion/hooks/useBandejas";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

export function BandejaPorTimbrar() {
  const navigate = useNavigate();
  const { data, isLoading } = useFacturasPorTimbrar();

  const columnas: ColumnaBandeja<FilaPorTimbrar>[] = [
    { key: "num", header: "Folio interno", cell: (r) => (
      <span className="font-mono">{r.numero.startsWith("BORRADOR-") ? "Sin folio" : r.numero}</span>
    ) },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    { key: "fe", header: "Emisión", cell: (r) => formatDate(r.fecha_emision) },
    { key: "tot", header: "Total", className: "text-right tabular-nums",
      cell: (r) => formatCurrency(r.total, r.moneda) },
  ];

  return (
    <TablaBandejaSimple<FilaPorTimbrar>
      columnas={columnas}
      data={data}
      isLoading={isLoading}
      emptyMessage="No hay facturas pendientes de timbrar. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: "Timbrar",
        icon: <Zap className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => navigate(`/facturacion/${r.id}?accion=timbrar`),
      }}
    />
  );
}
