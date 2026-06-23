/** Iniciales (2 chars) a partir del email. Fallback: "?". */
export function inicialesDeEmail(email: string): string {
  if (!email || email === "No disponible") return "?";
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}
