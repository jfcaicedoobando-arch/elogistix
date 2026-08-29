/**
 * Validación pura para el onboarding inicial. Extraída para mantener
 * `Onboarding.tsx` por debajo del límite Power of 10 (200 líneas).
 */

export type OnboardingValidationResult =
  | { ok: true; rfc: string; direccion: string; moneda: string }
  | { ok: false; message: string };

const MONEDAS_VALIDAS = ["MXN", "USD", "EUR"] as const;

/**
 * B-20: RFC mexicano con estructura SAT.
 * - Persona moral: 3 letras + fecha AAMMDD + homoclave (12 caracteres).
 * - Persona física: 4 letras + fecha AAMMDD + homoclave (13 caracteres).
 * Admite Ñ y & en la parte alfabética y valida mes/día plausibles.
 */
const RFC_REGEX =
  /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;

export function validateOnboarding(input: {
  rfc: string;
  direccion: string;
  moneda: string;
  skipFiscal: boolean;
}): OnboardingValidationResult {
  const rfcClean = input.skipFiscal ? "" : input.rfc.trim().toUpperCase();
  const dirClean = input.skipFiscal ? "" : input.direccion.trim();

  if (!input.skipFiscal) {
    // B-20: el RFC deja de ser opcional cuando la org captura datos fiscales.
    if (rfcClean === "") {
      return {
        ok: false,
        message:
          "Captura el RFC de la organización o marca “omitir datos fiscales” para hacerlo después.",
      };
    }
    if (!RFC_REGEX.test(rfcClean)) {
      return {
        ok: false,
        message:
          "El RFC no tiene un formato válido. Persona moral: 12 caracteres (3 letras + fecha + homoclave); persona física: 13 (4 letras + fecha + homoclave). Ejemplo: ABC010203XY4.",
      };
    }
    if (dirClean !== "" && (dirClean.length < 5 || dirClean.length > 500)) {
      return { ok: false, message: "La dirección debe tener entre 5 y 500 caracteres." };
    }
  }
  if (!MONEDAS_VALIDAS.includes(input.moneda as (typeof MONEDAS_VALIDAS)[number])) {
    return { ok: false, message: "Selecciona una moneda válida." };
  }
  return { ok: true, rfc: rfcClean, direccion: dirClean, moneda: input.moneda };
}
