import { describe, it, expect } from "vitest";
import { buildEmbarquePayload } from "@/features/embarques/domain/mappers/embarqueToDb";
import { mapEmbarqueRowToFormValues, DEFAULT_EMBARQUE_VALUES } from "@/features/embarques/domain/mappers/embarqueFromDb";
import { opcionesConValorGuardado } from "@/features/embarques/domain/opcionesCatalogo";

describe("embarqueToDb · buildEmbarquePayload", () => {
  it("convierte strings vacíos en null para campos opcionales", () => {
    const payload = buildEmbarquePayload(
      {
        ...DEFAULT_EMBARQUE_VALUES,
        modo: "Marítimo",
        tipo: "Importación",
        clienteId: "cli-1",
        shipper: "__manual__",
        shipperManual: "Shipper SA",
        consignatario: "__manual__",
        consignatarioManual: "Consignee SA",
        incoterm: "FOB",
        descripcionMercancia: "Mercancía X",
        pesoKg: "100",
        volumenM3: "1",
        piezas: "1",
        puertoOrigen: "",
        puertoDestino: "MXZLO",
        naviera: "",
      },
      [],
      "Cliente ACME",
      "operador@x.com",
    );
    expect(payload.puerto_origen).toBeNull();
    expect(payload.puerto_destino).toBe("MXZLO");
    expect(payload.naviera).toBeNull();
    expect(payload.cliente_nombre).toBe("Cliente ACME");
    expect(payload.operador).toBe("operador@x.com");
  });

  it("resuelve consignatario === __cliente__ al nombre del cliente", () => {
    const payload = buildEmbarquePayload(
      {
        ...DEFAULT_EMBARQUE_VALUES,
        modo: "Marítimo",
        tipo: "Importación",
        clienteId: "cli-1",
        consignatario: "__cliente__",
        shipper: "__manual__",
        shipperManual: "X",
        descripcionMercancia: "y",
        pesoKg: "1",
        volumenM3: "1",
        piezas: "1",
      },
      [],
      "ACME SA",
      "op@x",
    );
    expect(payload.consignatario).toBe("ACME SA");
  });
});

describe("embarqueFromDb · mapEmbarqueRowToFormValues", () => {
  it("rellena campos null con defaults legibles para el formulario", () => {
    const form = mapEmbarqueRowToFormValues({
      id: "e-1",
      modo: "Marítimo",
      tipo: "Importación",
      cliente_id: "cli-1",
      shipper: "S",
      consignatario: "C",
      incoterm: "FOB",
      descripcion_mercancia: "X",
      peso_kg: 100,
      volumen_m3: 1,
      piezas: 1,
      tipo_carga: null,
      msds_archivo: null,
      puerto_origen: null,
      puerto_destino: null,
      naviera: null,
      agente: null,
      tipo_servicio: null,
      contenedor: null,
      tipo_contenedor: null,
      bl_master: null,
      bl_house: null,
      aeropuerto_origen: null,
      aeropuerto_destino: null,
      aerolinea: null,
      mawb: null,
      hawb: null,
      ciudad_origen: null,
      ciudad_destino: null,
      transportista: null,
      carta_porte: null,
      etd: null,
      eta: null,
      tipo_cambio_usd: 17.5,
      tipo_cambio_eur: 19,
    } as unknown as Parameters<typeof mapEmbarqueRowToFormValues>[0]);
    expect(form.tipoCarga).toBe("Carga General");
    expect(form.naviera).toBe("");
    expect(form.etd).toBe("");
    expect(form.tipoCambioUSD).toBe("17.5");
    expect(form.tipoCambioEUR).toBe("19");
    expect(form.subiendoMsds).toBe(false);
  });
});

/**
 * P1-5 — El paso 2 del editor no debe quedar vacío cuando el catálogo de
 * navieras/agentes resuelve después del embarque.
 */
describe("opcionesConValorGuardado · paso 2 del editor (P1-5)", () => {
  const valores = mapEmbarqueRowToFormValues({
    ...({} as Record<string, unknown>),
    naviera: "Maersk",
    naviera_id: "nav-1",
    agente: "Agente Global",
    agente_id: "ag-1",
    bl_master: "BL-123",
    etd: "2026-08-01",
    eta: "2026-08-20",
  } as never);

  it("mapea naviera/agente/BL/ETD/ETA del embarque", () => {
    expect(valores.navieraId).toBe("nav-1");
    expect(valores.agenteId).toBe("ag-1");
    expect(valores.blMaster).toBe("BL-123");
    expect(valores.etd).toBe("2026-08-01");
    expect(valores.eta).toBe("2026-08-20");
  });

  it("inyecta el valor guardado mientras el catálogo está vacío", () => {
    const opciones = opcionesConValorGuardado([], valores.navieraId, valores.naviera);
    expect(opciones).toEqual([{ id: "nav-1", label: "Maersk" }]);
  });

  it("no duplica la opción cuando el catálogo ya resolvió", () => {
    const catalogo = [{ id: "nav-1", label: "Maersk" }];
    expect(opcionesConValorGuardado(catalogo, "nav-1", "Maersk")).toEqual(catalogo);
  });

  it("mantiene visible un agente inactivo/archivado con texto neutro", () => {
    const opciones = opcionesConValorGuardado([{ id: "ag-9", label: "Otro" }], "ag-1", "");
    expect(opciones[0]).toEqual({ id: "ag-1", label: "Valor guardado (cargando catálogo…)" });
  });
});
