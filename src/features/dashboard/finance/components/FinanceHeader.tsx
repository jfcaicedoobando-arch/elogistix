import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  saludo: string;
  nombre: string;
  hoyStr: string;
  vencidoMxn: number;
  porPagarMxn: number;
  porTimbrar: number;
}

export function FinanceHeader({
  saludo,
  nombre,
  hoyStr,
  vencidoMxn,
  porPagarMxn,
  porTimbrar,
}: Props) {
  const resumen = [
    vencidoMxn > 0 ? `${formatCurrency(vencidoMxn, "MXN")} vencido` : null,
    porPagarMxn > 0 ? `${formatCurrency(porPagarMxn, "MXN")} por pagar` : null,
    porTimbrar > 0 ? `${porTimbrar} por timbrar` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <PageHeader
      title={`${saludo}${nombre ? `, ${nombre}` : ""} 👋`}
      description={hoyStr}
      actions={
        resumen ? (
          <Badge variant="secondary" className="text-xs w-fit">
            {resumen}
          </Badge>
        ) : undefined
      }
    />
  );
}
