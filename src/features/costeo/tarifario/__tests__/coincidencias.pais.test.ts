import { describe, expect, it } from "vitest";
import { tarifasCoincidentes, type SolicitudBusqueda } from "../coincidencias";
import type { TarifaTarifario } from "../tarifarioService";

const base: SolicitudBusqueda = {
  pol: null, pod: null, origen: "CHINA", destino: "México", servicio: "Marítimo",
  tipo_carga: "40HC", container_size: null, fecha_tentativa_carga: null,
};
const t = (id: string, origen: string, pais: string, flete: number): TarifaTarifario => ({
  id, flete_base: flete, moneda: "USD", dias_libres_demoras: 14,
  vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", notas: null, solicitud_pricing_id: null,
  agente: null, naviera: null, tipo: { code: "40HC" },
  ruta: { origen: { name: origen, country: pais }, destino: { name: "Manzanillo", country: "México" } },
});
const tarifas = [t("sha", "Shanghai", "China", 300), t("nin", "Ningbo", "China", 200), t("bus", "Busan", "Corea del Sur", 100)];
const ids = (c: Partial<SolicitudBusqueda>) => tarifasCoincidentes({ ...base, ...c }, tarifas, "2026-10-09").map((x) => x.id);

describe("coincidencias por país", () => {
  it("sugiere todas las tarifas del país aunque no haya puerto", () => {
    expect(ids({})).toEqual(["nin", "sha"]);
  });
  it("el puerto pedido sólo ordena primero, no excluye", () => {
    expect(ids({ pol: "Shanghai, China (CNSHA)" })).toEqual(["sha", "nin"]);
  });
  it("modos no marítimos no tienen sugerencias", () => {
    expect(ids({ servicio: "Aéreo" })).toEqual([]);
  });
  it("otro país de destino no coincide", () => {
    expect(ids({ destino: "Colombia" })).toEqual([]);
  });
});
