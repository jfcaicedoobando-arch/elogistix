/** Ajustes locales a reportes; no cambian los documentos fiscales compartidos. */
export const reporteHeaderTextStyle = {
  fontSize: 8,
  letterSpacing: 0,
  textTransform: "none" as const,
  lineHeight: 1.25,
};

/** El loader legado devuelve "Empresa" si faltan los datos de configuración. */
export function nombreEmisorReporte(emisor?: { razonSocial?: string }): string | undefined {
  const nombre = emisor?.razonSocial?.trim();
  return nombre && nombre !== "Empresa" ? nombre : undefined;
}
