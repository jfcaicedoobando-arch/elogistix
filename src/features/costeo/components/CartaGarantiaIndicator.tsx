/**
 * Indicador de estado de la carta de garantía de la naviera.
 * Extraído de TarifaResultCard para cumplir Power of 10 (≤200 líneas).
 *
 * Ola 2 · RN-3: los colores vienen del `statusRegistry` (dominio
 * `carta_garantia`), nunca de clases escritas a mano.
 */
import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { TopTarifaRow } from "@/features/costeo/types";

function resolverEstado(row: TopTarifaRow): { estado: string; Icon: LucideIcon } {
  if (!row.naviera_condicion_id) return { estado: "Sin condiciones", Icon: ShieldOff };
  if (row.naviera_carta_garantia_activa) return { estado: "Carta vigente", Icon: ShieldCheck };
  if (row.naviera_tiene_carta_garantia) return { estado: "Carta vencida", Icon: ShieldAlert };
  return { estado: "Sin carta", Icon: ShieldOff };
}

export function CartaGarantiaIndicator({ row }: { row: TopTarifaRow }) {
  const { estado, Icon } = resolverEstado(row);
  return (
    <StatusBadge domain="carta_garantia" status={estado}>
      <span className="inline-flex items-center gap-1">
        <Icon className="size-3" aria-hidden />
        {estado}
      </span>
    </StatusBadge>
  );
}
