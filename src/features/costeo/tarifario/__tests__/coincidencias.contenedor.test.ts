import { describe, expect, it } from "vitest";
import { tarifasCoincidentes, type SolicitudBusqueda } from "../coincidencias";
import type { TarifaTarifario } from "../tarifarioService";

const solicitud: SolicitudBusqueda = {
  pol: "Shanghai", pod: "Manzanillo", origen: null, destino: null,
  tipo_carga: "40' High Cube", container_size: null, fecha_tentativa_carga: null,
};
const tarifa = (code: string, cambios: Partial<TarifaTarifario> = {}): TarifaTarifario => ({
  id: code, flete_base: 100, moneda: "USD", dias_libres_demoras: 14,
  vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", notas: null, solicitud_pricing_id: null,
  agente: null, naviera: null, tipo: { code },
  ruta: { origen: { name: "Shanghai" }, destino: { name: "Manzanillo" } }, ...cambios,
});
const tarifas = [tarifa("20GP"), tarifa("40GP"), tarifa("40HC"), tarifa("40HQ"), tarifa("40RF")];
const ids = (cambios: Partial<SolicitudBusqueda>, opciones = tarifas) =>
  tarifasCoincidentes({ ...solicitud, ...cambios }, opciones, "2026-10-08").map((t) => t.id);

describe("compatibilidad comercial del contenedor de Pricing", () => {
  it.each([null, undefined])("usa tipo_carga aunque container_size sea %s", (container_size) => {
    expect(ids({ container_size })).toEqual(["40HC", "40HQ"]);
  });
  it.each(["40HC", " 40 hq ", "40' High Cube", "40 HighCube"])("resuelve %s con el catálogo compartido", (tipo_carga) => {
    expect(ids({ tipo_carga })).toEqual(["40HC", "40HQ"]);
  });
  it("tipo_carga prevalece sobre un tamaño legacy contradictorio", () => {
    expect(ids({ container_size: "20GP" })).toEqual(["40HC", "40HQ"]);
  });
  it.each([null, undefined, "", "  "])("sólo recurre al tipo legacy si tipo_carga es %s", (tipo_carga) => {
    expect(ids({ tipo_carga, container_size: "40HC" })).toEqual(["40HC", "40HQ"]);
  });
  it.each([
    { tipo_carga: null, container_size: null },
    { tipo_carga: undefined, container_size: undefined },
    { tipo_carga: "  ", container_size: "" },
    { tipo_carga: "40", container_size: null },
    { tipo_carga: "40'", container_size: "40HC" },
    { tipo_carga: "desconocido", container_size: "40HC" },
  ])("no convierte un tipo ausente o incompleto en comodín: %j", (campos) => {
    expect(ids(campos)).toEqual([]);
  });
  it("mantiene distintos tamaños y categorías y acepta aliases de Dry", () => {
    expect(ids({ tipo_carga: "20' Dry (Standard)" }, [...tarifas, tarifa("20DV")])).toEqual(["20GP", "20DV"]);
    expect(ids({ tipo_carga: "40GP" })).toEqual(["40GP"]);
    expect(ids({ tipo_carga: "40 Reefer" })).toEqual(["40RF"]);
  });
  it("usa también el nombre del catálogo y rechaza una tarifa sin tipo", () => {
    expect(ids({}, [tarifa("HC", { tipo: { code: "HC", name: "40' High Cube" } }), tarifa("vacía", { tipo: null })]))
      .toEqual(["HC"]);
  });
  it("sólo acepta tipos personalizados por igualdad exacta normalizada", () => {
    expect(ids({ tipo_carga: "Especial A" }, [tarifa("A", { tipo: { code: "A", name: "Especial A" } }), tarifa("B")]))
      .toEqual(["A"]);
  });
  it("rechaza nombres/códigos contradictorios y claves sin identidad", () => {
    expect(ids({}, [tarifa("20GP", { tipo: { code: "20GP", name: "40' High Cube" } }),
      tarifa("40GP", { tipo: { code: "40GP", name: "40' High Cube" } })])).toEqual([]);
    expect(ids({ tipo_carga: "???" }, [tarifa("???")])).toEqual([]);
    expect(ids({ tipo_carga: "A" }, [tarifa("A", { tipo: { code: "A", name: "Especial A" } })])).toEqual([]);
  });
  it.each([
    ["20HC", "20'", "40HC"],
    ["40HC", "20'", "40HC"],
    ["40HC", "High Cube", "40GP"],
    ["40GP", "High Cube", "40GP"],
  ])("campos parciales contradictorios: pedido %s, nombre %s, código %s", (tipo_carga, name, code) => {
    expect(ids({ tipo_carga }, [tarifa(code, { tipo: { name, code } })])).toEqual([]);
  });
  it.each([
    ["40HC", "40'", "HC"],
    ["40HC", "High Cube", "40HC"],
    ["20GP", "20'", "20GP"],
    ["40HC", "40'", "40HC"],
    ["20HC", "20'", "HC"],
    ["40HC", "High Cube", "40"],
  ])("campos parciales coherentes: pedido %s, nombre %s, código %s", (tipo_carga, name, code) => {
    expect(ids({ tipo_carga }, [tarifa(code, { tipo: { name, code } })])).toEqual([code]);
  });
  it("conserva ruta, vigencia y orden de precios sin límite", () => {
    const opciones = Array.from({ length: 12 }, (_, i) => tarifa("40HC", { id: String(i), flete_base: 12 - i }));
    opciones.push(tarifa("40HC", { id: "vencida", vigente_hasta: "2026-10-07" }));
    opciones.push(tarifa("40HC", { id: "futura", vigente_desde: "2026-10-20" }));
    opciones.push(tarifa("40HC", { id: "otra ruta", ruta: { origen: { name: "Busan" }, destino: { name: "Manzanillo" } } }));
    expect(ids({}, opciones)).toEqual(["11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0"]);
    expect(ids({ fecha_tentativa_carga: "2026-11-01" }, opciones)).toEqual([]);
  });
});
