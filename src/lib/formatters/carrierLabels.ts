/**
 * UIB-11: etiquetas legibles para códigos de naviera (SCAC) en superficies
 * de cliente. Mapa estático deliberado: sin dependencia de RLS/catálogo y
 * disponible también para el tracking público. Si el código no está mapeado
 * se muestra tal cual (mejor código conocido que silencio).
 */
const SCAC_NAVIERAS: Record<string, string> = {
  MAEU: "Maersk",
  MSCU: "MSC",
  COSU: "COSCO Shipping",
  HLCU: "Hapag-Lloyd",
  EGLV: "Evergreen",
  CMDU: "CMA CGM",
  ONEY: "ONE",
  ZIMU: "ZIM",
};

export function labelNaviera(code: string | null | undefined): string {
  if (!code) return "—";
  const limpio = code.trim();
  const nombre = SCAC_NAVIERAS[limpio.toUpperCase()];
  return nombre ? `${nombre} (${limpio.toUpperCase()})` : limpio;
}
