export const configuracion = {
  all: ['configuracion'] as const,
  catalogoClavesSat: (organizationId?: string | null) =>
    ['catalogo_claves_sat', organizationId] as const,
} as const;

export const puertos = {
  all: ['puertos'] as const,
  activos: ['puertos', 'activos'] as const,
  todos: ['puertos', 'todos'] as const,
} as const;

export const exchangeRates = {
  all: ['exchange-rates'] as const,
} as const;

export const navieras = {
  all: ['navieras'] as const,
  activas: ['navieras', 'activas'] as const,
  todas: ['navieras', 'todas'] as const,
} as const;

export const tiposContenedor = {
  all: ['tipos_contenedor'] as const,
  activos: ['tipos_contenedor', 'activos'] as const,
  todos: ['tipos_contenedor', 'todos'] as const,
} as const;

export const configuracionGlobal = {
  all: ['configuracion_global'] as const,
  categoria: (cat: string) => ['configuracion_global', cat] as const,
} as const;

export const configuracionOrg = {
  byOrg: (orgId: string) => ['configuracion', 'org', orgId] as const,
} as const;
