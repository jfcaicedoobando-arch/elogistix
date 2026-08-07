/**
 * Corte del saldo inicial de una cuenta bancaria (v13.451.0).
 *
 * `cuentas_bancarias.fecha_saldo_inicial` es la fecha a la que corresponde el
 * saldo capturado al dar de alta la cuenta. Los movimientos con fecha anterior
 * a ese corte ya venían contenidos en ese saldo, así que NO vuelven a sumarse
 * ni a restarse (la base de datos aplica el mismo filtro).
 *
 * Dominio puro: sin red ni React.
 */

/** `true` si `fecha` (YYYY-MM-DD) es anterior al corte del saldo inicial. */
export function esAnteriorAlCorte(
  fecha: string | null | undefined,
  corte: string | null | undefined,
): boolean {
  if (!fecha || !corte) return false;
  return fecha.slice(0, 10) < corte.slice(0, 10);
}

/**
 * Texto del aviso cuando el movimiento queda antes del corte. Devuelve `null`
 * cuando no hay nada que advertir.
 */
export function avisoFechaPreviaCorte(args: {
  fecha: string | null | undefined;
  corte: string | null | undefined;
  aliasCuenta?: string | null;
}): string | null {
  if (!esAnteriorAlCorte(args.fecha, args.corte)) return null;
  const cuenta = args.aliasCuenta ? `de "${args.aliasCuenta}"` : "de esta cuenta";
  return (
    `La fecha es anterior al arranque ${cuenta}. El movimiento se guardará como ` +
    "historial, pero no modificará el saldo actual porque ya estaba incluido en el saldo inicial."
  );
}
