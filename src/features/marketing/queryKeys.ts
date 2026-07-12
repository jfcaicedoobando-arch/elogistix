export const marketing = {
  isDemoUser: (userId?: string | null) => ["is_demo_user", userId ?? "anon"] as const,
} as const;
