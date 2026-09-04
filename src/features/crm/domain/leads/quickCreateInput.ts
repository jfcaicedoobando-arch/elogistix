/**
 * Alta rápida de lead: el usuario captura un solo campo "Correo o teléfono".
 *
 * Fuente única de la clasificación hacia las columnas canónicas de
 * `public.crm_leads` (`email` / `telefono`), para que la ficha (`LeadDatosCard`)
 * y el encabezado muestren siempre el mismo dato que se persistió.
 */
import type { LeadInput } from "./constants";

export interface QuickCreateAuthLite {
  id?: string | null;
  email?: string | null;
}

/** ¿El valor capturado parece un correo? (heurística mínima: usuario@dominio) */
export function esCorreoCapturado(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(valor.trim());
}

export function leadQuickCreateInput(
  empresa: string,
  contacto: string,
  user: QuickCreateAuthLite | null,
): LeadInput {
  const dato = contacto.trim();
  const esCorreo = esCorreoCapturado(dato);
  return {
    empresa: empresa.trim(),
    contacto: "",
    email: esCorreo ? dato.toLowerCase() : "",
    telefono: esCorreo ? "" : dato,
    fuente: "Otro",
    estado: "Nuevo",
    vendedor_id: user?.id ?? null,
    vendedor_email: user?.email ?? "",
  };
}
