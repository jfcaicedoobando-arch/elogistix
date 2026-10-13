/** ETD vencida es una alerta operativa, nunca evidencia de un zarpe. */
export function esSalidaPendienteDeConfirmar(
  estado: string,
  etd: string | null | undefined,
  ahora = new Date(),
): boolean {
  if (estado !== "Confirmado" || !etd || !/^\d{4}-\d{2}-\d{2}$/.test(etd)) return false;
  const fecha = new Date(`${etd}T00:00:00Z`);
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== etd) return false;
  // Un día estimado aún en curso no está vencido. UTC coincide con current_date.
  return etd < ahora.toISOString().slice(0, 10);
}
