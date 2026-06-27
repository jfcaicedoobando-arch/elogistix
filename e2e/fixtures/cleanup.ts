/**
 * Helpers de cleanup best-effort para specs E2E mutadores.
 *
 * Política: si el cleanup falla NO debe romper el spec — el assert principal
 * ya pasó. Sólo logueamos un warning para que el operador limpie a mano.
 */

export async function bestEffortCleanup(
  label: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[e2e cleanup] '${label}' falló: ${(err as Error).message}`);
  }
}
