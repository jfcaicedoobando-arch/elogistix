import { TZ_MX } from "./dates";

const formatoDia = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ_MX, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Clave de calendario YYYY-MM-DD de un instante en la zona de negocio, no en UTC. */
export function fechaDiaNegocio(iso: string): string | null {
  const fecha = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = formatoDia.formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}
