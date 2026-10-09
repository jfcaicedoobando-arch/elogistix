import type { CarteraDataScope } from "./services/carteraSnapshot";

export const carteraKeys = {
  snapshot: (scope: CarteraDataScope, diaNegocio: string) =>
    ["reportes", "cartera", scope.userId, scope.organizationId, scope.role, scope.generation, diaNegocio] as const,
} as const;
