export const cxc = {
  all: ["cxc"] as const,
  aging: (fecha?: string | null) => ["cxc", "aging", fecha ?? "hoy"] as const,
} as const;
