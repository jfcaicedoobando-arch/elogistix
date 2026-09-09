/**
 * Fecha fiscal de una factura para reportería (EERR devengado).
 *
 * El SAT reconoce el CFDI en la fecha de **certificación** (`timbrado_en`).
 * `fecha_emision` es la fecha capturada antes de enviar al PAC y puede quedar
 * en otro día (p. ej. se captura el 31 y el timbre sale el 1). Cuando existe
 * `timbrado_en` manda esa fecha, convertida a la zona horaria de México.
 */
const TZ_MX = "America/Mexico_City";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_MX,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO timestamp → `YYYY-MM-DD` en hora de México. */
export function fechaMx(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fmt.format(d);
}

/** Fecha (YYYY-MM-DD) con la que la factura debe reconocerse en el mes. */
export function fechaFiscalFactura(f: {
  fecha_emision: string;
  timbrado_en?: string | null;
}): string {
  if (f.timbrado_en) {
    const mx = fechaMx(f.timbrado_en);
    if (mx) return mx;
  }
  return f.fecha_emision;
}
