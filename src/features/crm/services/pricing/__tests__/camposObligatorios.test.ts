import { describe, expect, it } from "vitest";
import { camposFaltantesSolicitud } from "../camposObligatorios";

const completa = {
  solicitante_id: "u", fecha: "2026-11-05", cliente: "ACME", servicio: "Marítimo", tipo_operacion: "Importación",
  incoterm: "FOB", sector_economico: "General", imo: false, commodity: "Llantas", tipo_carga: "40' HC", cantidad: 1,
  estibable: true, peso: "1000", unidad_medida: "kg", dimensiones: "1x1x1", origen: "China", pol: "CNSHA",
  destino: "México", pod: "MXZLO",
};

describe("camposFaltantesSolicitud", () => {
  it("una solicitud completa no tiene faltantes aunque no traiga notas, delivery ni fecha tentativa", () => {
    expect(camposFaltantesSolicitud(completa)).toEqual([]);
  });
  it("IMO o Estibable en 'No' cuentan como capturados", () => {
    expect(camposFaltantesSolicitud({ ...completa, imo: false, estibable: false })).toEqual([]);
  });
  it("lista los obligatorios vacíos", () => {
    expect(camposFaltantesSolicitud({ ...completa, sector_economico: null, commodity: " " }))
      .toEqual(["Sector económico", "Commodity"]);
  });
});
