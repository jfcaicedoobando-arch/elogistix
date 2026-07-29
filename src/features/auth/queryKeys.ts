/**
 * Keys de TanStack Query del dominio de autenticación.
 *
 * M9 (auditoría de arquitectura 2026-07-29): el contexto de usuario
 * (perfil + roles + organización) dejó de vivir en un cache manual con TTL y
 * pasó a TanStack Query. La key se declara aquí para que cualquier feature que
 * mute la organización pueda invalidarla sin hardcodear arrays inline
 * (guardrail ESLint `QUERY_KEY_AND_IVA_RULES`).
 */
export const auth = {
  /** Raíz del namespace: invalida el contexto de cualquier usuario. */
  userContextAll: ["auth", "user-context"] as const,
  userContext: (uid: string | null) => ["auth", "user-context", uid ?? "anon"] as const,
} as const;
