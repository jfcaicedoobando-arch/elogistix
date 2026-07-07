/**
 * Bandeja "Por enviar": CFDI ya timbrados que aún no se han
 * mandado por correo al cliente. Acción rápida: ir al detalle
 * y abrir el diálogo de envío.
 */
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFacturasPorEnviar, type FilaPorEnviar } from "@/features/facturacion/hooks/useBandejas";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

export function BandejaPorEnviar() {
  const navigate = useNavigate();
  const { data, isLoading } = useFacturasPorEnviar();

  const columnas: ColumnaBandeja<FilaPorEnviar>[] = [
    { key: "num", header: "Folio", cell: (r) => <span className="font-mono">{r.numero}</span> },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    { key: "fe", header: "Emisión", cell: (r) => formatDate(r.fecha_emision) },
    { key: "tot", header: "Total", className: "text-right tabular-nums",
      cell: (r) => formatCurrency(r.total, r.moneda) },
  ];

  return (
    <TablaBandejaSimple<FilaPorEnviar>
      columnas={columnas}
      data={data}
      isLoading={isLoading}
      emptyMessage="Todos los CFDI timbrados ya se enviaron. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: "Enviar CFDI",
        icon: <Send className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => navigate(`/facturacion/${r.id}?accion=enviar`),
      }}
    />
  );
}
