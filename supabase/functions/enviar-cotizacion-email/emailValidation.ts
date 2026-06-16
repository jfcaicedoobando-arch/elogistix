/** Validador de email simple para uso en edge functions. Extraído para tests aislados. */
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
