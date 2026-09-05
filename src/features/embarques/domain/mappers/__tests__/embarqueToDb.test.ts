import { describe, it, expect } from "vitest";
import {
  buildEmbarquePayload,
  buildConceptosVentaPayload,
  buildConceptosCostoPayload,
} from "../embarqueToDb";
import { DEFAULT_EMBARQUE_VALUES } from "../embarqueFromDb";

const contactos = [
  { id: "ct1", nombre: "Shipper Co", tipo: "Exportador" as const, pais: "CN" },
];

const baseValues = {
  ...DEFAULT_EMBARQUE_VALUES,
  modo: "Marítimo",
  tipo: "Importación",
  clienteId: "cl1",
  shipper: "ct1",
  consignatario: "__cliente__",
  incoterm: "FOB",
  descripcionMercancia: "carga seca",
  pesoKg: "100",
  volumenM3: "2",
  piezas: "5",
  puertoOrigen: "CNSHA",
  puertoDestino: "MXZLO",
  naviera: "COSCO",
  tipoServicio: "FCL",
  contenedor: "ABCD1",
  tipoContenedor: "40HC",
  etd: "2026-01-01",
  eta: "2026-02-01",
};

describe("buildEmbarquePayload (toDb)", () => {
  it("resuelve shipper desde catálogo y consignatario = cliente", () => {
    const p = buildEmbarquePayload(baseValues, contactos, "Cliente SA", "operador@x.com");
    expect(p.shipper).toBe("Shipper Co — Exportador (CN)");
    expect(p.consignatario).toBe("Cliente SA");
    expect(p.cliente_nombre).toBe("Cliente SA");
    expect(p.operador).toBe("operador@x.com");
  });

  it("convierte vacíos a null en campos opcionales", () => {
    const p = buildEmbarquePayload({ ...baseValues, agente: "", blHouse: "" }, contactos, "X", "op");
    expect(p.agente).toBeNull();
    expect(p.bl_house).toBeNull();
  });

  it("LCL forza tipo_contenedor='LCL'", () => {
    const p = buildEmbarquePayload({ ...baseValues, tipoServicio: "LCL" }, contactos, "X", "op");
    expect(p.tipo_servicio).toBe("LCL");
    expect(p.tipo_contenedor).toBe("LCL");
  });

  it("suma totales desde contenedores dinámicos en FCL", () => {
    const p = buildEmbarquePayload(
      {
        ...baseValues,
        contenedores: [
          { numero_contenedor: "C1", tipo_contenedor: "40HC", peso_kg: 100, volumen_m3: 10, piezas: 5 },
          { numero_contenedor: "C2", tipo_contenedor: "40HC", peso_kg: 200, volumen_m3: 20, piezas: 15 },
        ] as never,
      },
      contactos,
      "X",
      "op",
    );
    expect(p.peso_kg).toBe(300);
    expect(p.volumen_m3).toBe(30);
    expect(p.piezas).toBe(20);
    expect(p.contenedor).toBe("C1");
  });

  // v13.823.151 (B4) — En FCL los contenedores son la única verdad (igual que el
  // trigger de BD): una fila en ceros deja el total en cero de forma explícita.
  // La pérdida silenciosa se evita sembrando el primer contenedor al cambiar a
  // FCL (ver `domain/semillaContenedor.ts`).
  it("respeta la suma de contenedores en cero (corrección explícita)", () => {
    const p = buildEmbarquePayload(
      {
        ...baseValues,
        pesoKg: "12000",
        volumenM3: "35.5",
        piezas: "8",
        contenedores: [
          { numero_contenedor: "C1", tipo_contenedor: "40HC", peso_kg: 0, volumen_m3: 0, piezas: 0 },
        ] as never,
      },
      contactos,
      "X",
      "op",
    );
    expect(p.peso_kg).toBe(0);
    expect(p.volumen_m3).toBe(0);
    expect(p.piezas).toBe(0);
  });


  it("rechaza modo inválido vía zod", () => {
    expect(() => buildEmbarquePayload({ ...baseValues, modo: "Espacial" }, contactos, "X", "op")).toThrow();
  });

  it("rechaza incoterm inválido", () => {
    expect(() => buildEmbarquePayload({ ...baseValues, incoterm: "XXX" }, contactos, "X", "op")).toThrow();
  });

  it("convierte tipos de cambio vacíos, 0 o NaN a null (respetando CHECK > 0)", () => {
    const p1 = buildEmbarquePayload(
      { ...baseValues, tipoCambioUSD: "" as never, tipoCambioEUR: "" as never },
      contactos, "X", "op",
    );
    expect(p1.tipo_cambio_usd).toBeNull();
    expect(p1.tipo_cambio_eur).toBeNull();

    const p2 = buildEmbarquePayload(
      { ...baseValues, tipoCambioUSD: "0" as never, tipoCambioEUR: "0" as never },
      contactos, "X", "op",
    );
    expect(p2.tipo_cambio_usd).toBeNull();
    expect(p2.tipo_cambio_eur).toBeNull();

    const p3 = buildEmbarquePayload(
      { ...baseValues, tipoCambioUSD: "17.46" as never, tipoCambioEUR: "19.87" as never },
      contactos, "X", "op",
    );
    expect(p3.tipo_cambio_usd).toBe(17.46);
    expect(p3.tipo_cambio_eur).toBe(19.87);
  });
});

describe("buildConceptosVentaPayload (toDb)", () => {
  it("filtra conceptos sin descripción y calcula total", () => {
    const out = buildConceptosVentaPayload([
      { concepto: "Flete", cantidad: 2, precioUnitario: 100, moneda: "USD" } as never,
      { concepto: "", cantidad: 1, precioUnitario: 10, moneda: "MXN" } as never,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].total).toBe(200);
    expect(out[0].moneda).toBe("USD");
  });

  it("rechaza moneda inválida", () => {
    expect(() =>
      buildConceptosVentaPayload([
        { concepto: "X", cantidad: 1, precioUnitario: 1, moneda: "GBP" } as never,
      ]),
    ).toThrow();
  });
});

describe("buildConceptosCostoPayload (toDb)", () => {
  it("resuelve proveedor_nombre desde catálogo y filtra vacíos", () => {
    const out = buildConceptosCostoPayload(
      [
        { concepto: "Manejo", monto: 50, moneda: "MXN", proveedorId: "p1" } as never,
        { concepto: "", monto: 0, moneda: "MXN", proveedorId: null } as never,
      ],
      [{ id: "p1", nombre: "Operador SA" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].proveedor_id).toBe("p1");
    expect(out[0].proveedor_nombre).toBe("Operador SA");
  });

  it("proveedor inexistente deja nombre vacío", () => {
    const out = buildConceptosCostoPayload(
      [{ concepto: "X", monto: 10, moneda: "USD", proveedorId: "ghost" } as never],
      [],
    );
    expect(out[0].proveedor_nombre).toBe("");
  });
});
