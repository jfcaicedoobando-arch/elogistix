/**
 * Validación y normalización del correo en el alta de usuarios.
 * Extraído de `NuevoUsuarioDialog.tsx` para respetar el límite de 200 líneas.
 *
 * Alineado con lo que acepta el servicio de identidad: sólo ASCII, sin puntos
 * consecutivos ni al final, y dominio con extensión de 2+ letras. La regex laxa
 * anterior dejaba pasar correos que el proveedor rechazaba al guardar.
 */
const EMAIL_REGEX =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Normaliza igual que el backend (recorta espacios y baja a minúsculas). */
export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

/** `true` si el correo (ya normalizado o no) es aceptable para el alta. */
export function esEmailValido(valor: string): boolean {
  return EMAIL_REGEX.test(normalizarEmail(valor));
}
