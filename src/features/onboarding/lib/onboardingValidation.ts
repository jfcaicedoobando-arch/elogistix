/**
 * Validación pura para el onboarding inicial. Extraída para mantener
 * `Onboarding.tsx` por debajo del límite Power of 10 (200 líneas).
 */

export type OnboardingValidationResult =
  | { ok: true; rfc: string; direccion: string; moneda: string }
  | { ok: false; message: string };

const MONEDAS_VALIDAS = ["MXN", "USD", "EUR"] as const;

export function validateOnboarding(input: {
  rfc: string;
  direccion: string;
  moneda: string;
  skipFiscal: boolean;
}): OnboardingValidationResult {
  const rfcClean = input.skipFiscal ? "" : input.rfc.trim().toUpperCase();
  const dirClean = input.skipFiscal ? "" : input.direccion.trim();

  if (!input.skipFiscal) {
    if (rfcClean !== "" && (rfcClean.length < 12 || rfcClean.length > 13)) {
      return {
        ok: false,
        message: "El RFC debe tener 12 caracteres (persona moral) o 13 (persona física).",
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
