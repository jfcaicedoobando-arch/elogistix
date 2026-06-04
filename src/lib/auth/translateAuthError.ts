/**
 * Traduce errores comunes de Supabase Auth a mensajes amigables en es-MX.
 * Si no encuentra una traducción específica, devuelve el mensaje original.
 */
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Ocurrió un error inesperado. Intenta de nuevo.";
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
  }
  if (m.includes("email not confirmed")) {
    return "Tu cuenta aún no está confirmada. Revisa tu correo y abre el enlace de activación.";
  }
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "Este email ya está registrado. Inicia sesión o recupera tu contraseña.";
  }
  if (m.includes("password should be at least")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.";
  }
  if (m.includes("user not found")) {
    return "No existe una cuenta con ese email.";
  }
  if (m.includes("new password should be different")) {
    return "La nueva contraseña debe ser diferente a la actual.";
  }
  if (m.includes("token has expired") || m.includes("invalid token")) {
    return "El enlace expiró o no es válido. Solicita uno nuevo.";
  }
  return message;
}
