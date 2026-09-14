/**
 * Dominio puro: frescura del seguimiento de un embarque.
 * Extraído de `TabTracking.tsx` (v13.823.370) para poder probarse aislado.
 */
import { diffDiasCalendario } from "@/lib/date/dateOnly";

export interface Freshness {
  label: string;
  critical: boolean;
  etaProxima: boolean;
  dias: number;
}

/**
 * v13.823.370 (P2-3) — Un Borrador recién convertido no tiene eventos porque la
 * operación todavía no empieza: acusarlo con "Requiere actualización" es ruido.
 * La advertencia se conserva para embarques ya confirmados/en tránsito.
 */
export function computeFreshness(
  eventos: Array<{ fecha: string; tipo: string; ubicacion: string | null }>,
  eta: string | null | undefined,
  arribado: boolean,
  estado?: string | null,
): Freshness {
  if (eventos.length === 0) {
    const esBorrador = (estado ?? "").trim().toLowerCase() === "borrador";
    if (esBorrador) {
      return {
        label: "Pendiente de iniciar seguimiento",
        critical: false,
        etaProxima: false,
        dias: 0,
      };
    }
    return { label: "Sin eventos registrados", critical: !arribado, etaProxima: false, dias: 0 };
  }
  const ultimo = eventos[0];
  const dias = diffDiasCalendario(ultimo.fecha, new Date());
  const ubicacion = ultimo.ubicacion ? ` en ${ultimo.ubicacion}` : "";

  if (arribado) {
    return {
      label: `Arribado — ${ultimo.tipo}${ubicacion}`,
      critical: false,
      etaProxima: false,
      dias,
    };
  }

  const diasParaEta = eta != null ? diffDiasCalendario(new Date(), eta) : null;
  const etaProxima = diasParaEta != null && diasParaEta >= 0 && diasParaEta <= 2;
  const label = dias === 0
    ? `Último evento hoy — ${ultimo.tipo}`
    : `Último evento hace ${dias} día${dias === 1 ? "" : "s"} — ${ultimo.tipo}${ubicacion}`;
  return { label, critical: dias >= 7 || etaProxima, etaProxima, dias };
}
