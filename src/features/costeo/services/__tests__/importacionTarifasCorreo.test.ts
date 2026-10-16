import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAgentesImportacionCorreo, fetchCatalogosImportacionCorreo, fetchTarifasConflictosImportacion } from "../importacionTarifasCorreo";
import { detectarConflictos } from "../../tarifario/duplicadosTarifas";
import { prepararImportacion, type TarifaImport } from "../../tarifario/importarTarifas";
import { faltantesDeCatalogo } from "../../tarifario/correo/faltantesCatalogo";
import type { FilaCorreo } from "../../tarifario/correo/comun";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

const org = "org-a";
const existente = {
  id: "ex", organization_id: org, agente_id: "ag", naviera_id: "nav", ruta_id: "ruta", tipo_contenedor_id: "t20",
  flete_base: 90, vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", estado: "vigente", estado_aprobacion: "borrador",
};
const lote: TarifaImport[] = [{ fila: 2, origenId: "o", destinoId: "d", input: {
  agente_id: "ag", naviera_id: "nav", ruta_id: "ruta", tipo_contenedor_id: "t20", flete_base: 100,
  vigente_desde: "2026-10-14", vigente_hasta: "2026-10-31", dias_libres_demoras: 21, recargos: [],
} }];
const fila: FilaCorreo = {
  Origen: "Shanghai", Destino: "Manzanillo", Agente: "Longsail", Naviera: "MAEU",
  "Tarifa 20": 100, "Tarifa 40": 0, "Inicio de la vigencia": "2026-10-14", "Término de la vigencia": "2026-10-31",
  "Días libres": 21, Observaciones: "Sintética",
};
const puerto = { id: "o", name: "Shanghai", code: "CNSHA", activo: true };
const destino = { id: "d", name: "Manzanillo", code: "MXZLO", activo: true };
const naviera = { id: "nav", name: "Maersk", code: "MAEU", activo: true };
const tipo = { id: "t20", name: "20 GP", code: "20GP", activo: true, created_at: "2020-01-01" };
type Row = Record<string, unknown>;
let tablas: Record<string, Row[]>;
let fallo: { tabla: string; desde: number } | null;
const consultas: { tabla: string; eq: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; desde: number; hasta: number }[] = [];

beforeEach(() => {
  tablas = { costeo_tarifas: [], puertos: [puerto, destino], navieras: [naviera], tipos_contenedor: [tipo],
    catalogo_org_desactivado: [], costeo_agentes: [{ id: "ag", nombre: "Longsail", organization_id: org }],
    costeo_rutas: [{ id: "ruta", puerto_origen_id: "o", puerto_destino_id: "d", organization_id: org }] };
  fallo = null;
  consultas.length = 0;
  from.mockReset().mockImplementation((tabla: string) => {
    let rows = tablas[tabla] ?? [];
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((col: string, value: unknown) => { rows = rows.filter((r) => r[col] === value); return q; }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((desde: number, hasta: number) => {
        consultas.push({ tabla, eq: q.eq, order: q.order, desde, hasta });
        return Promise.resolve({ data: rows.slice(desde, hasta + 1),
          error: fallo?.tabla === tabla && fallo.desde === desde ? { message: "falló página posterior" } : null });
      }),
    };
    return q;
  });
});

describe("lecturas completas de importación de correo", () => {
  it("detecta la coincidencia en la segunda página sin incluir otra organización", async () => {
    tablas.costeo_tarifas = [...Array.from({ length: 1000 }, (_, i) => ({ ...existente, id: `otra-${i}`, agente_id: "otro" })),
      existente, { ...existente, id: "ajena", organization_id: "org-b" }];
    const rows = await fetchTarifasConflictosImportacion(org);
    expect(rows).toHaveLength(1001);
    expect(detectarConflictos(lote, rows, [], "2026-10-14")).toMatchObject([{ indice: 0, tipo: "existente", fleteOtro: 90 }]);
    expect(consultas.map((q) => [q.desde, q.hasta])).toEqual([[0, 999], [1000, 1999]]);
    for (const q of consultas) {
      expect(q.eq).toHaveBeenCalledExactlyOnceWith("organization_id", org);
      expect(q.order).toHaveBeenCalledExactlyOnceWith("id");
    }
  });

  it("consulta una página vacía tras una página exacta de conflictos", async () => {
    tablas.costeo_tarifas = Array.from({ length: 1000 }, (_, i) => ({ ...existente, id: `ex-${i}` }));
    expect(await fetchTarifasConflictosImportacion(org)).toHaveLength(1000);
    expect(consultas.map((q) => q.desde)).toEqual([0, 1000]);
  });

  it("propaga el error posterior de conflictos sin devolver el parcial", async () => {
    tablas.costeo_tarifas = Array.from({ length: 1000 }, () => existente);
    fallo = { tabla: "costeo_tarifas", desde: 1000 };
    await expect(fetchTarifasConflictosImportacion(org)).rejects.toEqual({ message: "falló página posterior" });
  });

  it("reconoce puertos y navieras después de 500 y de 1000 y valida sus filas", async () => {
    tablas.puertos = [...Array.from({ length: 1000 }, (_, i) => ({ ...puerto, id: `p-${i}`, code: `P${i}`, name: `Puerto ${i}` })), puerto, destino];
    tablas.navieras = [...Array.from({ length: 1000 }, (_, i) => ({ ...naviera, id: `n-${i}`, code: `N${i}`, name: `Naviera ${i}` })), naviera];
    const c = await fetchCatalogosImportacionCorreo(org);
    expect(faltantesDeCatalogo([fila], c.existencia)).toEqual({ puertos: [], navieras: [], pendientes: [] });
    expect(prepararImportacion([{ ...fila }], c.validacion, c.existencia).tarifas).toHaveLength(1);
    for (const q of consultas.filter((q) => ["puertos", "navieras", "tipos_contenedor", "costeo_agentes", "costeo_rutas"].includes(q.tabla))) {
      expect(q.order).toHaveBeenLastCalledWith("id");
    }
  });

  it.each(["puertos", "navieras", "tipos_contenedor", "catalogo_org_desactivado", "costeo_agentes", "costeo_rutas"])("no devuelve catálogos parciales si falla la segunda página de %s", async (tabla) => {
    const row = tablas[tabla][0] ?? { catalogo: "puertos", item_id: "p", organization_id: org };
    tablas[tabla] = Array.from({ length: 1000 }, () => row);
    fallo = { tabla, desde: 1000 };
    await expect(fetchCatalogosImportacionCorreo(org)).rejects.toEqual({ message: "falló página posterior" });
  });

  it.each(["global", "organización"])("reconoce inactivos a nivel %s sin ofrecer altas ni validar la tarifa", async (nivel) => {
    if (nivel === "global") {
      tablas.puertos = [{ ...puerto, activo: false }, destino];
      tablas.navieras = [{ ...naviera, activo: false }];
      tablas.tipos_contenedor = [{ ...tipo, activo: false }];
    } else {
      tablas.catalogo_org_desactivado = [
        { catalogo: "puertos", item_id: "o", organization_id: org },
        { catalogo: "navieras", item_id: "nav", organization_id: org },
        { catalogo: "tipos_contenedor", item_id: "t20", organization_id: org },
      ];
    }
    const c = await fetchCatalogosImportacionCorreo(org);
    expect(faltantesDeCatalogo([fila], c.existencia).pendientes).toEqual([]);
    expect(c.validacion.tipos).toEqual([]);
    const prep = prepararImportacion([{ ...fila }], c.validacion, c.existencia);
    expect(prep.tarifas).toEqual([]);
    expect(prep.errores[0]).toContain("origen «Shanghai» está inactivo");
    expect(prep.errores[0]).toContain("naviera «MAEU» está inactiva");
    expect(prep.errores[0]).not.toContain("no existe");
  });

  it("pagina la visibilidad con scope de organización e ignora apagados ajenos", async () => {
    tablas.catalogo_org_desactivado = [
      ...Array.from({ length: 1000 }, (_, i) => ({ catalogo: "puertos", item_id: `otro-${i}`, organization_id: org })),
      { catalogo: "puertos", item_id: "o", organization_id: org },
      { catalogo: "puertos", item_id: "d", organization_id: "org-b" },
    ];
    const c = await fetchCatalogosImportacionCorreo(org);
    expect(c.validacion.puertos.map((p) => p.id)).toEqual(["d"]);
    for (const q of consultas.filter((q) => q.tabla === "catalogo_org_desactivado")) {
      expect(q.eq).toHaveBeenCalledExactlyOnceWith("organization_id", org);
      expect(q.order.mock.calls).toEqual([["catalogo"], ["item_id"]]);
    }
  });

  it("recupera agentes y rutas de otra página con filtro de organización", async () => {
    tablas.costeo_agentes = [...Array.from({ length: 1000 }, (_, i) => ({ id: `a-${i}`, nombre: "Otro", organization_id: org })),
      { id: "ag", nombre: "Longsail", organization_id: org }, { id: "ajeno", nombre: "Longsail", organization_id: "org-b" }];
    tablas.costeo_rutas = [...Array.from({ length: 1000 }, (_, i) => ({ id: `r-${i}`, organization_id: org })), ...tablas.costeo_rutas];
    const c = await fetchCatalogosImportacionCorreo(org);
    expect(c.validacion.agentes).toHaveLength(1001);
    expect(c.validacion.rutas).toHaveLength(1001);
    expect(prepararImportacion([{ ...fila }], c.validacion).tarifas[0].input.ruta_id).toBe("ruta");
  });

  it("reconoce un alias histórico inactivo en otra página sin cambiar el UUID preparado", async () => {
    tablas.tipos_contenedor = [
      ...Array.from({ length: 1000 }, (_, i) => ({ ...tipo, id: `tipo-${i}`, code: `X${i}`, name: `Especial ${i}`, activo: false })),
      tipo, { ...tipo, id: "legacy", activo: false, created_at: "2010-01-01" },
    ];
    const c = await fetchCatalogosImportacionCorreo(org);
    const prep = prepararImportacion([{ ...fila }], c.validacion, c.existencia);
    expect(c.validacion.tipos.map((t) => t.id)).toEqual(["t20"]);
    expect(detectarConflictos(prep.tarifas, [{ ...existente, tipo_contenedor_id: "legacy" }], c.validacion.rutas, "2026-10-14", c.tiposComparacion))
      .toMatchObject([{ indice: 0, tipo: "existente" }]);
    expect(prep.tarifas[0].input.tipo_contenedor_id).toBe("t20");
  });

  it("conserva el resultado pequeño y las altas sólo para registros inexistentes", async () => {
    const c = await fetchCatalogosImportacionCorreo(org);
    expect(prepararImportacion([{ ...fila }], c.validacion).tarifas).toMatchObject(lote);
    expect(faltantesDeCatalogo([{ ...fila, Origen: "Nuevo" }], c.existencia).puertos).toEqual(["Nuevo"]);
    expect(await fetchAgentesImportacionCorreo(org)).toEqual(tablas.costeo_agentes);
  });
});
