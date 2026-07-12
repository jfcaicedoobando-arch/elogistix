export const notificaciones = {
  all: ["notificaciones-internas"] as const,
  internas: (userId?: string | null) => ["notificaciones-internas", userId] as const,
} as const;
