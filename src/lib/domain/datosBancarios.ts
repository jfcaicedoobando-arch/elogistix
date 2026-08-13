/**
 * Validación de datos bancarios de proveedor (CLABE nacional / SWIFT extranjero).
 *
 * P2-1 (R5, v13.389.0): la validación vivía sólo en el alta; el modal de edición
 * guardaba una CLABE de 17 dígitos sin avisar. Este módulo es la única fuente
 * de verdad y se usa en alta y edición.
 */

const CLABE_RE = /^\d{18}$/;
const SWIFT_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// Dígito verificador CLABE (mod-10 con pesos 3-7-1). Especificación Banxico.
const CLABE_WEIGHTS = [3, 7, 1] as const;

export function clabeDigitoVerificadorValido(clabe: string): boolean {
  if (!CLABE_RE.test(clabe)) return false;
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += (Number(clabe[i]) * CLABE_WEIGHTS[i % 3]) % 10;
  }
  const dv = (10 - (suma % 10)) % 10;
  return dv === Number(clabe[17]);
}

export interface ErrorBancario {
  campo: "clabe" | "swift_bic";
  mensaje: string;
}

/** Devuelve el error de campo o `null` si los datos bancarios son válidos. */
export function validarDatosBancarios(opts: {
  esExtranjero: boolean;
  clabe: string | null | undefined;
  swiftBic: string | null | undefined;
}): ErrorBancario | null {
  const clabe = (opts.clabe ?? "").trim();
  const swift = (opts.swiftBic ?? "").trim().toUpperCase();
  if (!opts.esExtranjero && clabe) {
    if (!CLABE_RE.test(clabe)) {
      return { campo: "clabe", mensaje: "La CLABE debe tener exactamente 18 dígitos numéricos." };
    }
    if (!clabeDigitoVerificadorValido(clabe)) {
      return {
        campo: "clabe",
        mensaje: "La CLABE tiene un dígito verificador inválido — revisa que no tenga errores de tipeo.",
      };
    }
  }
  if (opts.esExtranjero && swift && !SWIFT_RE.test(swift)) {
    return { campo: "swift_bic", mensaje: "El SWIFT/BIC debe tener 8 u 11 caracteres alfanuméricos." };
  }
  return null;
}

export { CLABE_RE, SWIFT_RE };
