/**
 * v13.312.22 — helper extraído de SignupForm para bajar complejidad ciclomática.
 * Vive fuera del componente para no romper fast-refresh (react-refresh/only-export-components).
 */
export const SIGNUP_FIELD_ORDER = [
  "name",
  "company",
  "phone",
  "email",
  "password",
  "password2",
  "acceptTerms",
] as const;

export function getFirstFieldError(
  errors: Record<string, { message?: string } | undefined>,
): string | null {
  for (const field of SIGNUP_FIELD_ORDER) {
    const msg = errors[field]?.message;
    if (msg) return msg;
  }
  return null;
}
