/** Copy del estado vacío: nunca confundir un filtro sin resultados con cartera cobrada. */
export function carteraEmptyState({ search, moneda, urgencia, dateFrom, dateTo }: {
  search: string;
  moneda: string;
  urgencia: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  if (search.trim() || moneda !== "todas" || dateFrom || dateTo) {
    return { message: "Sin resultados para estos filtros", hint: "Cambia o limpia los filtros para revisar otras facturas con saldo." };
  }
  if (urgencia === "todas") {
    return { message: "Sin facturas con saldo pendiente", hint: "No hay saldo pendiente en la cartera consultada." };
  }
  const message = urgencia === "vencidas" ? "Sin facturas vencidas"
    : urgencia === "por_vencer" ? "Sin facturas por vencer en los próximos 7 días"
    : "Sin facturas vencidas ni por vencer en los próximos 7 días";
  return { message, hint: "Selecciona Todas con saldo para revisar la cartera completa." };
}
