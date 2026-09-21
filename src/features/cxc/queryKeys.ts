export const cxc = {
  all: ["cxc"] as const,
  aging: (fecha?: string | null, organizationId?: string | null) =>
    ["cxc", "aging", fecha ?? "hoy", organizationId] as const,
} as const;
