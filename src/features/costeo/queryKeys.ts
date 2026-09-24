/**
 * Query key factory para el dominio Costeo.
 * Uso: `queryKeys.costeo.tarifas.list(orgId, filters)`.
 */
export const costeo = {
  all: ["costeo"] as const,

  tarifas: {
    all: ["costeo", "tarifas"] as const,
    list: (organizationId: string | null | undefined, filters: unknown = {}) =>
      ["costeo", "tarifas", organizationId, filters] as const,
    recargos: (tarifaId: string) => ["costeo", "tarifa-recargos", tarifaId] as const,
    pendientesAprobacion: (organizationId: string | null | undefined) =>
      ["costeo", "tarifas", "pendientes-aprobacion", organizationId] as const,
    resumen: (ids: readonly string[]) => ["tarifas", "resumen", ids] as const,
    top: (params: {
      organizationId: string | null | undefined;
      puertoOrigenId: string | null | undefined;
      puertoDestinoId: string | null | undefined;
      tipoContenedorId: string | null | undefined;
      fecha: string | null | undefined;
    }) =>
      [
        "costeo",
        "top-tarifas",
        params.organizationId,
        params.puertoOrigenId,
        params.puertoDestinoId,
        params.tipoContenedorId,
        params.fecha ?? null,
      ] as const,
  },

  /** Diagnóstico cuando el Top 3 de tarifas viene vacío. */
  diagnosticoTarifas: (params: {
    organizationId: string | null | undefined;
    puertoOrigenId: string | undefined;
    puertoDestinoId: string | undefined;
    tipoContenedorIds: readonly string[];
    hoy: string;
  }) =>
    [
      "costeo",
      "diagnostico-tarifas",
      params.organizationId,
      params.puertoOrigenId,
      params.puertoDestinoId,
      [...params.tipoContenedorIds].sort(),
      params.hoy,
    ] as const,

  agentes: {
    all: ["costeo", "agentes"] as const,
    list: (organizationId: string | null | undefined) =>
      ["costeo", "agentes", organizationId] as const,
  },

  rutas: {
    all: ["costeo", "rutas"] as const,
    list: (organizationId: string | null | undefined) =>
      ["costeo", "rutas", organizationId] as const,
  },

  navieras: {
    condiciones: {
      all: ["costeo", "navieras_condiciones"] as const,
      list: (organizationId: string | null | undefined) =>
        ["costeo", "navieras_condiciones", organizationId] as const,
    },
    demorasTramos: {
      all: ["costeo", "demoras_tramos"] as const,
      list: (navieraCondicionId: string | null | undefined) =>
        ["costeo", "demoras_tramos", navieraCondicionId] as const,
    },
    tiposContenedor: () => ["costeo", "tipos_contenedor_demoras"] as const,
    // P2-2: cuelga de `navieras.all` para que el alta de naviera la invalide.
    catalogo: () => ["navieras", "costeo_catalogo"] as const,
  },

  proveedores: {
    all: ["costeo", "proveedores"] as const,
    porTipo: (tipo: string) => ["costeo", "proveedores", tipo] as const,
  },
} as const;
