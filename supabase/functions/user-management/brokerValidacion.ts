/** Validación pura del alta de broker (sin red ni base). */
export interface AltaBroker {
  email: string;
  nombre: string;
  comision_pct: number;
  organization_id: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarAltaBroker(body: Record<string, unknown>): AltaBroker | string {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const organization_id = typeof body.organization_id === "string" ? body.organization_id : "";
  const pct = typeof body.comision_pct === "number" ? body.comision_pct : Number.NaN;
  if (!email || !nombre || !organization_id) return "Faltan campos: nombre, correo y organización";
  if (!EMAIL_RE.test(email)) return "Correo electrónico inválido";
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "El % de comisión debe estar entre 0 y 100";
  return { email, nombre, organization_id, comision_pct: Math.round(pct * 100) / 100 };
}
