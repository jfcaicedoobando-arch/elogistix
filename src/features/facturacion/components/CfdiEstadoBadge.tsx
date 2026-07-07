/**
 * CfdiEstadoBadge — chip unificado para estados de CFDI (factura, NC y REP).
 *
 * Normaliza el esquema de color y texto en toda la pantalla de detalle
 * de factura: borrador → gris, aprobada → ámbar, timbrada → azul,
 * aplicada → verde, cancelada → rojo. El texto respeta el género del
 * documento (Timbrada/Cancelada para NC; Timbrado/Cancelado para REP).
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CfdiEstadoTono =
  | "borrador"
  | "aprobada"
  | "timbrada"
  | "aplicada"
  | "cancelada";

const TONO_CLASS: Record<CfdiEstadoTono, string> = {
  borrador:  "bg-muted text-muted-foreground border-transparent font-normal",
  aprobada:  "bg-warning/10 text-warning border-warning/20",
  timbrada:  "bg-info/10 text-info border-info/20",
  aplicada:  "bg-success/10 text-success border-success/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  tono: CfdiEstadoTono;
  children: React.ReactNode;
  className?: string;
  /** Para folios (font-mono). */
  mono?: boolean;
}

export function CfdiEstadoBadge({ tono, children, className, mono }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(TONO_CLASS[tono], "text-xs", mono && "font-mono", className)}
    >
      {children}
    </Badge>
  );
}
