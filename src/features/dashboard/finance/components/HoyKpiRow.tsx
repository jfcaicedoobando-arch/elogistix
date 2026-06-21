import { FileText, Banknote, AlertCircle, Inbox } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { KpiTile } from "./KpiTile";

interface Props {
  porTimbrar: number;
  porPagarMxn: number;
  porPagarUsd: number;
  vencidoMxn: number;
  vencidoUsd: number;
  porCapturar: number;
  loading: boolean;
}

export function HoyKpiRow({
  porTimbrar,
  porPagarMxn,
  porPagarUsd,
  vencidoMxn,
  vencidoUsd,
  porCapturar,
  loading,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        icon={<FileText className="h-4 w-4 text-blue-600" />}
        label="Por timbrar"
        value={porTimbrar}
        sublabel="Facturas pendientes"
        to="/facturacion/por-emitir"
        tone={porTimbrar > 0 ? "warning" : "default"}
        loading={loading}
      />
      <KpiTile
        icon={<Banknote className="h-4 w-4 text-indigo-600" />}
        label="Por pagar"
        value={formatCurrency(porPagarMxn, "MXN")}
        sublabel={
          porPagarUsd > 0 ? `+ ${formatCurrency(porPagarUsd, "USD")}` : "Facturas proveedor"
        }
        to="/cxp/por-pagar"
        loading={loading}
      />
      <KpiTile
        icon={<AlertCircle className="h-4 w-4 text-red-600" />}
        label="Vencido (cartera)"
        value={formatCurrency(vencidoMxn, "MXN")}
        sublabel={vencidoUsd > 0 ? `+ ${formatCurrency(vencidoUsd, "USD")}` : "Cobranza"}
        to="/cartera"
        tone={vencidoMxn > 0 || vencidoUsd > 0 ? "danger" : "success"}
        loading={loading}
      />
      <KpiTile
        icon={<Inbox className="h-4 w-4 text-emerald-600" />}
        label="Por capturar (CxP)"
        value={porCapturar}
        sublabel="Conceptos sin factura"
        to="/cxp/por-capturar"
        tone={porCapturar > 0 ? "warning" : "default"}
        loading={loading}
      />
    </div>
  );
}
