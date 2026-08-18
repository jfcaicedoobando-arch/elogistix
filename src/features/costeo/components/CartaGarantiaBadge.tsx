/**
 * N-UI-01 (Ola 7): esta variante (Badge sólido sin iconos) se unificó con la de
 * `features/cotizacion/components/CartaGarantiaBadge.tsx` (outline + iconos,
 * más informativa), que ahora es la ÚNICA implementación. Este módulo sólo
 * re-exporta para no romper los imports de costeo/portal-agente.
 *
 * TODO(shared): mover el componente a `src/components/shared` y apuntar ambos
 * features ahí cuando el ownership de ese directorio lo permita.
 */
export {
  CartaGarantiaBadge,
  default,
} from "@/features/cotizacion/components/CartaGarantiaBadge";
