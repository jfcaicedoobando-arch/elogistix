import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/**
 * Formatea un teléfono mexicano (o internacional) usando libphonenumber-js/min.
 * Para MX preserva el estilo visual "(LADA) NNNN-NNNN" pero deja que la librería
 * decida si la lada es de 2 o 3 dígitos.
 *
 *   "5512345678"        → "(55) 1234-5678"   (CDMX, 2 dígitos)
 *   "4422170696"        → "(442) 217-0696"   (Querétaro, 3 dígitos)
 *   "+5215512345678"    → "+52 (55) 1234-5678"
 *   números no-MX       → formato internacional canónico
 *   inválido            → string original (no destruimos input)
 */
export const formatPhoneMx = (raw: string | null | undefined): string => {
  if (!raw) return "";
  let phone;
  try {
    phone = parsePhoneNumberFromString(raw, "MX");
  } catch {
    return raw;
  }
  if (!phone || !phone.isValid()) return raw;

  if (phone.country === "MX") {
    const parts = phone.formatNational().split(" ").filter(Boolean);
    if (parts.length >= 2) {
      const area = parts[0];
      const rest = parts.slice(1).join("-");
      const prefix = raw.trim().startsWith("+") ? "+52 " : "";
      return `${prefix}(${area}) ${rest}`;
    }
  }
  return phone.formatInternational();
};
