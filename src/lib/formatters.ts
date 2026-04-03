export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  return formatter.format(amount);
};

/** Extrae la primera parte de un nombre compuesto (antes de coma o guión largo) */
export const shortName = (raw: string | null): string =>
  raw?.split(/[,—]/)[0].trim() || "-";
