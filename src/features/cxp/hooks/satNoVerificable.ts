/**
 * Aviso compartido para el estatus `No verificable` del SAT (código 601).
 *
 * El servicio público del SAT rechaza la "expresión impresa" cuando alguno de
 * los RFC contiene `&` (ej. `AL&0807074L5`), porque ese mismo caracter es el
 * separador de campos de la consulta. No significa que el CFDI sea inválido:
 * hay que verificarlo a mano en el portal del SAT.
 *
 * v13.322.17
 */
import { notifyWarning } from "@/lib/ui/appFeedback";
import { SAT_VERIFICA_CFDI_URL } from "@/constants/externalUrls";

export function notificarNoVerificable(detalle?: string) {
  notifyWarning(undefined, {
    title: "El SAT no pudo procesar la consulta automática",
    description:
      detalle ??
      "El SAT rechazó la expresión de consulta (código 601). Suele pasar cuando el RFC contiene '&'. Verifica el CFDI manualmente en el portal del SAT.",
    duration: 10000,
    action: {
      label: "Abrir portal SAT",
      onClick: () => window.open(SAT_VERIFICA_CFDI_URL, "_blank", "noopener,noreferrer"),
    },
  });
}
