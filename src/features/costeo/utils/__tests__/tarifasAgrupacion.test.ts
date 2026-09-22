import { describe, it, expect } from "vitest";
import { buildGruposTarifas, esTarifaElegible, type FilaAgrupable } from "../tarifasAgrupacion";

const TODAY = "2026-07-29";

function fila(overrides: Partial<FilaAgrupable> = {}): FilaAgrupable {
  return {
    ruta_id: "ruta-1",
    tipo_contenedor_id: "tc-40hc",
    puerto_origen_nombre: "MZT",
    puerto_destino_nombre: "SHA",
    tipo_contenedor_nombre: "40HC",
    agente_nombre: "Agente A",
    total_comparable: 1000,
    vigente_hasta: "2026-12-31",
    estado: "activa",
    estado_aprobacion: "vigente",
    ...overrides,
  };
}

describe("esTarifaElegible", () => {
  it("tarifa en borrador de aprobación NO es elegible aunque sea la más barata", () => {
    expect(esTarifaElegible(fila({ estado_aprobacion: "borrador" }), TODAY)).toBe(false);
  });

  it("estado_aprobacion undefined se trata como vigente (legacy)", () => {
    expect(esTarifaElegible(fila({ estado_aprobacion: undefined }), TODAY)).toBe(true);
  });

  it("vigente_hasta < today excluye", () => {
    expect(esTarifaElegible(fila({ vigente_hasta: "2020-01-01" }), TODAY)).toBe(false);
  });

  it("estado reemplazada excluye", () => {
    expect(esTarifaElegible(fila({ estado: "reemplazada" }), TODAY)).toBe(false);
  });
});

describe("buildGruposTarifas", () => {
  it("con 0/1 elegibles, promedio/deltaMax quedan null", () => {
    const grupos = buildGruposTarifas([fila({ total_comparable: 900 })], TODAY);
    expect(grupos[0].elegiblesCount).toBe(1);
    expect(grupos[0].promedio).toBeNull();
    expect(grupos[0].deltaMax).toBeNull();
  });

  it("mejor es la elegible de menor total_comparable", () => {
    const grupos = buildGruposTarifas(
      [
        fila({ total_comparable: 1200, agente_nombre: "B" }),
        fila({ total_comparable: 900, agente_nombre: "A" }),
        fila({ total_comparable: 800, estado_aprobacion: "borrador", agente_nombre: "C" }),
      ],
      TODAY,
    );
    expect(grupos[0].mejor?.total_comparable).toBe(900);
    expect(grupos[0].elegiblesCount).toBe(2);
    expect(grupos[0].promedio).toBe(1050);
    expect(grupos[0].deltaMax).toBe(300);
  });
});

/**
 * Etapa 2 — identidad inequívoca en la agrupación.
 * Pasos: 1) puertos homónimos de países distintos no comparten grupo;
 * 2) la etiqueta y el contexto identifican Rotterdam → Veracruz;
 * 3) campos legacy nulos no ensucian la etiqueta.
 */
describe("buildGruposTarifas · identidad de puertos (Etapa 2)", () => {
  const rotterdam = fila({
    ruta_id: "ruta-nl",
    tipo_contenedor_id: "tc-40hc",
    puerto_origen_nombre: "Rotterdam",
    puerto_origen_code: "NLRTM",
    puerto_origen_country: "Países Bajos",
    puerto_destino_nombre: "Veracruz",
    puerto_destino_code: "MXVER",
    puerto_destino_country: "México",
  });

  it("no mezcla dos rutas con puertos homónimos de países distintos", () => {
    const santosBrasil = fila({
      ruta_id: "ruta-br",
      puerto_origen_nombre: "Santos",
      puerto_origen_code: "BRSSZ",
      puerto_origen_country: "Brasil",
      puerto_destino_nombre: "Veracruz",
      puerto_destino_code: "MXVER",
      puerto_destino_country: "México",
    });
    const santosEspana = fila({
      ruta_id: "ruta-es",
      puerto_origen_nombre: "Santos",
      puerto_origen_code: "ESSNS",
      puerto_origen_country: "España",
      puerto_destino_nombre: "Veracruz",
      puerto_destino_code: "MXVER",
      puerto_destino_country: "México",
    });
    const grupos = buildGruposTarifas([santosBrasil, santosEspana], TODAY);
    expect(grupos).toHaveLength(2);
    expect(new Set(grupos.map((g) => g.rutaContexto))).toEqual(
      new Set(["Brasil · BRSSZ → México · MXVER", "España · ESSNS → México · MXVER"]),
    );
  });

  it("separa por tipo de contenedor usando el ID, no el nombre visible", () => {
    const grupos = buildGruposTarifas(
      [rotterdam, fila({ ruta_id: "ruta-nl", tipo_contenedor_id: "tc-20" })],
      TODAY,
    );
    expect(grupos).toHaveLength(2);
  });

  it("Rotterdam NLRTM → Veracruz MXVER se muestra inequívocamente", () => {
    const [g] = buildGruposTarifas([rotterdam], TODAY);
    expect(g.rutaLabel).toBe("Rotterdam → Veracruz");
    expect(g.rutaContexto).toBe("Países Bajos · NLRTM → México · MXVER");
  });

  it("legacy sin code/country deja contexto vacío y etiqueta limpia", () => {
    const [g] = buildGruposTarifas([fila()], TODAY);
    expect(g.rutaLabel).toBe("MZT → SHA");
    expect(g.rutaContexto).toBe("");
  });

  it("la ruta China → México existente sigue agrupando igual", () => {
    const cnmx = (agente: string) => fila({
      ruta_id: "ruta-cn-mx",
      agente_nombre: agente,
      puerto_origen_nombre: "Shanghai",
      puerto_origen_code: "CNSHA",
      puerto_origen_country: "China",
      puerto_destino_nombre: "Manzanillo",
      puerto_destino_code: "MXZLO",
      puerto_destino_country: "México",
    });
    const grupos = buildGruposTarifas([cnmx("A"), cnmx("B")], TODAY);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].agentes).toBe(2);
    expect(grupos[0].rutaLabel).toBe("Shanghai → Manzanillo");
  });
});
