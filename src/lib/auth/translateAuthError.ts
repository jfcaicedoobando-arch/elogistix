/**
 * Traduce errores comunes de Supabase Auth a mensajes amigables en es-MX.
 * UIB-15: si no encuentra una traducción específica devuelve un genérico
 * es-MX — nunca el mensaje crudo del backend (ése queda en consola/Sentry).
 */
const TRADUCCIONES: Array<{ claves: string[]; mensaje: string }> = [
  {
    claves: ["email and password required", "missing email or phone"],
    mensaje: "Ingresa tu email y tu contraseña.",
  },
  {
    claves: ["invalid login credentials", "invalid_credentials"],
    mensaje: "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
  },
  {
    claves: ["email not confirmed"],
    mensaje: "Tu cuenta aún no está confirmada. Revisa tu correo y abre el enlace de activación.",
  },
  {
    claves: ["user already registered", "already registered"],
    mensaje: "Este email ya está registrado. Inicia sesión o recupera tu contraseña.",
  },
  {
    claves: ["password should be at least"],
    mensaje: "La contraseña debe tener al menos 6 caracteres.",
  },
  {
    claves: ["rate limit", "too many requests"],
    mensaje: "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
  },
  {
    claves: ["network", "failed to fetch"],
    mensaje: "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.",
  },
  {
    claves: ["user not found"],
    mensaje: "No existe una cuenta con ese email.",
  },
  {
    claves: ["new password should be different"],
    mensaje: "La nueva contraseña debe ser diferente a la actual.",
  },
  {
    claves: ["token has expired", "invalid token"],
    mensaje: "El enlace expiró o no es válido. Solicita uno nuevo.",
  },
];

const GENERICO = "Ocurrió un error inesperado. Intenta de nuevo.";

export function translateAuthError(message: string | undefined | null): string {
  if (!message) return GENERICO;
  const m = message.toLowerCase();
  const hit = TRADUCCIONES.find(({ claves }) => claves.some((c) => m.includes(c)));
  // UIB-15 (UX-02): nunca devolver el mensaje crudo del backend a la vista.
  return hit ? hit.mensaje : GENERICO;
}
