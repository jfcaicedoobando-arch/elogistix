/**
 * N-UI-01 (Ola 7) · ÚNICA implementación del badge de carta garantía.
 *
 * Antes había dos componentes con el mismo nombre y propósito: éste (outline +
 * iconos, informativo) y el de `features/costeo/components` (badge sólido de
 * una palabra). Se conserva esta variante y el módulo de costeo ahora sólo
 * re-exporta, para que los call-sites no cambien sus imports.
 *
 * Acepta dos formas de props:
 *  - `{ tarifa }` (cotización, desde `TopTarifaRow`).
 *  - `{ tieneCarta, vigenteHasta, navieraNombre? }` (costeo / portal-agente).
 *
 * TODO(shared): mover a `src/components/shared` y apuntar ambos features ahí
 * cuando el ownership de ese directorio lo permita.
 */
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { calcularEstadoCartaGarantia } from "@/features/costeo/types/navieraCondicion";
import { formatFechaSegura } from "@/lib/formatters/datesSegura";
import type { TopTarifaRow } from "@/features/costeo/types";

interface PropsTarifa {
  tarifa: TopTarifaRow;
  tieneCarta?: never;
  vigenteHasta?: never;
  navieraNombre?: never;
}

interface PropsManual {
  tarifa?: never;
  tieneCarta: boolean;
  vigenteHasta: string | null;
  /** Opcional: se muestra entre paréntesis cuando hay carta. */
  navieraNombre?: string | null;
}

export type CartaGarantiaBadgeProps = PropsTarifa | PropsManual;

/** Normaliza ambas formas de props a un único shape interno. */
function resolverDatos(props: CartaGarantiaBadgeProps): {
  tieneCarta: boolean;
  vigenteHasta: string | null;
  navieraNombre: string | null;
} {
  if (props.tarifa) {
    return {
      tieneCarta: props.tarifa.naviera_tiene_carta_garantia,
      vigenteHasta: props.tarifa.naviera_carta_garantia_vigente_hasta ?? null,
      navieraNombre: props.tarifa.naviera_nombre ?? null,
    };
  }
  return {
    tieneCarta: props.tieneCarta,
    vigenteHasta: props.vigenteHasta,
    navieraNombre: props.navieraNombre ?? null,
  };
}

export function CartaGarantiaBadge(props: CartaGarantiaBadgeProps) {
  const { tieneCarta, vigenteHasta, navieraNombre } = resolverDatos(props);
  const estado = calcularEstadoCartaGarantia(tieneCarta, vigenteHasta);
  const fecha = formatFechaSegura(vigenteHasta);
  const naviera = navieraNombre ? ` (${navieraNombre})` : "";

  if (estado === "sin_carta") {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <ShieldQuestion className="h-3.5 w-3.5" />
        Sin carta garantía — se cobrará depósito
      </Badge>
    );
  }
  if (estado === "vencida") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 bg-destructive/10 text-destructive border-destructive/30"
      >
        <ShieldX className="h-3.5 w-3.5" />
        Vencida{vigenteHasta ? ` el ${fecha}` : ""} — se cobrará depósito
      </Badge>
    );
  }
  if (estado === "por_vencer") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-warning/10 text-warning border-warning/30">
        <ShieldAlert className="h-3.5 w-3.5" />
        Por vencer el {fecha}
        {naviera}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 bg-success/10 text-success border-success/30">
      <ShieldCheck className="h-3.5 w-3.5" />
      Vigente hasta {fecha}
      {naviera}
    </Badge>
  );
}

export default CartaGarantiaBadge;
