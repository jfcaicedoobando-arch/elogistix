/**
 * Formatters compartidos por componentes de tarifas de costeo.
 */
export const usdTarifa = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(Number(n || 0));

export const formatFechaMx = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("T")[0].split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
};
