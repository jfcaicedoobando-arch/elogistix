/**
 * Bandeja "Proformas listas": proformas aprobadas internamente y sin
 * factura asociada. Acción rápida: convertir a factura borrador de un
 * clic (usa `useConvertirProformaDirecto`).
 */
import { useNavigate } from "react-router-dom";
import { FileCheck2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useOrgFilter } from "@/hooks/shared";
import { useProformasListas, type FilaProformaLista } from "@/features/facturacion/hooks/useProformasListas";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks/useConvertirProformaDirecto";
import { TablaBandejaSimple, type ColumnaBandeja } from "./TablaBandejaSimple";

export function BandejaProformasListas() {
  const navigate = useNavigate();
  const { data, isLoading } = useProformasListas();
  const { organizationId } = useOrgFilter();
  const { convertir, isPending } = useConvertirProformaDirecto();

  const columnas: ColumnaBandeja<FilaProformaLista>[] = [
    {
      key: "num",
      header: "Nº proforma",
      cell: (r) => <span className="font-mono">{r.numero || "—"}</span>,
    },
    { key: "cli", header: "Cliente", cell: (r) => r.cliente_nombre },
    {
      key: "exp",
      header: "Expediente",
      cell: (r) => r.expediente ?? "—",
    },
    {
      key: "tot",
      header: "Total",
      className: "text-right tabular-nums",
      cell: (r) => {
        if (r.total_usd && r.total_usd > 0) return formatCurrency(r.total_usd, "USD");
        if (r.total_mxn && r.total_mxn > 0) return formatCurrency(r.total_mxn, "MXN");
        return "—";
      },
    },
    { key: "fe", header: "Aprobada", cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <TablaBandejaSimple<FilaProformaLista>
      columnas={columnas}
      data={data}
      isLoading={isLoading}
      emptyMessage="No hay proformas aprobadas pendientes de facturar. ✅"
      rowKey={(r) => r.id}
      accion={{
        label: isPending ? "Convirtiendo..." : "Convertir a factura",
        icon: <FileCheck2 className="h-3.5 w-3.5 mr-1" />,
        onClick: (r) => {
          if (!organizationId || isPending) return;
          convertir(
            { proformaIds: [r.id], organizationId },
            {
              onSuccess: () => {
                navigate("/facturacion?bandeja=por-timbrar");
              },
            },
          );
        },
      }}
    />
  );
}
