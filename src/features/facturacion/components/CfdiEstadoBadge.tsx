/**
 * CfdiEstadoBadge — chip unificado para estados de CFDI (factura, NC y REP).
 *
 * v13.681.0 · UI-1: los colores ya NO viven aquí. Delegan al dominio `cfdi`
 * del `statusRegistry`, la única fuente de verdad de estados visuales.
 * El texto sigue viniendo del llamador para respetar el género del documento
 * (Timbrada/Cancelada para NC; Timbrado/Cancelado para REP).
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

export type CfdiEstadoTono =
  | "borrador"
  | "aprobada"
  | "timbrada"
  | "aplicada"
  | "cancelada";

interface Props {
  tono: CfdiEstadoTono;
  children: React.ReactNode;
  className?: string;
  /** Para folios (font-mono). */
  mono?: boolean;
}

export function CfdiEstadoBadge({ tono, children, className, mono }: Props) {
  return (
    <StatusBadge
      domain="cfdi"
      status={tono}
      className={cn(
        tono === "borrador" && "font-normal",
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </StatusBadge>
  );
}
