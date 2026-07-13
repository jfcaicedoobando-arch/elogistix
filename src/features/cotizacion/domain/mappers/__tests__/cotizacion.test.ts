import { describe, it, expect } from "vitest";
import { buildPaso1Data } from "../cotizacion";
import { COTIZACION_FORM_DEFAULTS } from "@/features/cotizacion/types";

const CLIENTES = [{ id: "cl1", nombre: "Cliente SA" }];

function values(over: Record<string, unknown> = {}) {
  return { ...COTIZACION_FORM_DEFAULTS, clienteId: "cl1", origen: "CNSHA", destino: "MXZLO", ...over } as never;
}

describe("buildPaso1Data — cliente", () => {
  it("resuelve cliente desde catálogo cuando no es prospecto", () => {
    const r = buildPaso1Data(values(), CLIENTES, "op@x.com");
    expect(r.es_prospecto).toBe(false);
    expect(r.cliente_id).toBe("cl1");
    expect(r.cliente_nombre).toBe("Cliente SA");
    expect(r.prospecto_empresa).toBe("");
  });

  it("usa datos de prospecto cuando esProspecto=true (cliente_id=null)", () => {
    const r = buildPaso1Data(
      values({ esProspecto: true, prospectoEmpresa: "Acme", prospectoEmail: "a@a" }),
      CLIENTES, "op@x.com",
    );
    expect(r.cliente_id).toBeNull();
    expect(r.cliente_nombre).toBe("Acme");
    expect(r.prospecto_empresa).toBe("Acme");
    expect(r.prospecto_email).toBe("a@a");
  });
});

describe("buildPaso1Data — peso/volumen/piezas por modo", () => {
  it("Marítimo LCL: suma volumen y piezas de dimensionesLCL", () => {
    const r = buildPaso1Data(
      values({
        modo: "Marítimo", tipoEmbarque: "LCL",
        dimensionesLCL: [
          { piezas: 2, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 1.5 },
          { piezas: 3, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 2 },
        ],
      }),
      CLIENTES, "op@x.com",
    );
    expect(r.peso_kg).toBe(0);
    expect(r.volumen_m3).toBe(3.5);
    expect(r.piezas).toBe(5);
  });

  it("Marítimo FCL: peso/volumen/piezas = 0 (se ignoran dimensiones)", () => {
    const r = buildPaso1Data(
      values({ modo: "Marítimo", tipoEmbarque: "FCL", pesoKg: 999, volumenM3: 999, piezas: 999 }),
      CLIENTES, "op@x.com",
    );
    expect(r.peso_kg).toBe(0);
    expect(r.volumen_m3).toBe(0);
    expect(r.piezas).toBe(0);
  });

  it("Aéreo: suma peso volumétrico y piezas, volumen=0", () => {
    const r = buildPaso1Data(
      values({
        modo: "Aéreo",
        dimensionesAereas: [
          { piezas: 5, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 100 },
          { piezas: 2, alto_cm: 0, largo_cm: 0, ancho_cm: 0, peso_volumetrico_kg: 25 },
        ],
      }),
      CLIENTES, "op@x.com",
    );
    expect(r.peso_kg).toBe(125);
    expect(r.volumen_m3).toBe(0);
    expect(r.piezas).toBe(7);
  });

  it("Terrestre: usa valores manuales del formulario", () => {
    const r = buildPaso1Data(
      values({ modo: "Terrestre", pesoKg: 1000, volumenM3: 12, piezas: 30 }),
      CLIENTES, "op@x.com",
    );
    expect(r.peso_kg).toBe(1000);
    expect(r.volumen_m3).toBe(12);
    expect(r.piezas).toBe(30);
  });
});

describe("buildPaso1Data — mercancía y ruta", () => {
  it("Terrestre forza incoterm 'N/A' y tipo_movimiento ''", () => {
    const r = buildPaso1Data(values({ modo: "Terrestre", incoterm: "FOB", tipoMovimiento: "X" }), CLIENTES, "op@x");
    expect(r.incoterm).toBe("N/A");
    expect(r.tipo_movimiento).toBe("");
  });

  it("Marítimo FCL: tipo_contenedor presente, dimensiones_lcl vacías", () => {
    const r = buildPaso1Data(values({ modo: "Marítimo", tipoEmbarque: "FCL", tipoContenedor: "40HC" }), CLIENTES, "op@x");
    expect(r.tipo_contenedor).toBe("40HC");
    expect(r.dimensiones_lcl).toEqual([]);
  });

  it("Marítimo LCL: tipo_contenedor=null y dias_almacenaje aplica", () => {
    const r = buildPaso1Data(values({ modo: "Marítimo", tipoEmbarque: "LCL", diasAlmacenaje: 5 }), CLIENTES, "op@x");
    expect(r.tipo_contenedor).toBeNull();
    expect(r.dias_almacenaje).toBe(5);
  });

  it("mapper cotizacion: seguro=false fuerza valor_seguro_usd=0", () => {
    const r = buildPaso1Data(values({ seguro: false, valorSeguroUsd: 10_000 }), CLIENTES, "op@x");
    expect(r.valor_seguro_usd).toBe(0);
  });

  it("valor_seguro_usd se respeta cuando seguro=true", () => {
    const r = buildPaso1Data(values({ seguro: true, valorSeguroUsd: 5_000 }), CLIENTES, "op@x");
    expect(r.valor_seguro_usd).toBe(5_000);
  });
});

describe("buildPaso1Data — vigencia y meta", () => {
  it("vigencia_dias = 15 por defecto cuando no hay validez", () => {
    const r = buildPaso1Data(values({ validezPropuesta: undefined }), CLIENTES, "op@x");
    expect(r.vigencia_dias).toBe(15);
    expect(r.validez_propuesta).toBeNull();
  });

  it("vigencia_dias mínimo 1 incluso si validez está en el pasado", () => {
    const ayer = new Date(Date.now() - 24 * 3600 * 1000);
    const r = buildPaso1Data(values({ validezPropuesta: ayer }), CLIENTES, "op@x");
    expect(r.vigencia_dias).toBeGreaterThanOrEqual(1);
  });

  it("validez_propuesta se serializa a YYYY-MM-DD", () => {
    const fecha = new Date("2030-12-25T10:00:00Z");
    const r = buildPaso1Data(values({ validezPropuesta: fecha }), CLIENTES, "op@x");
    expect(r.validez_propuesta).toBe("2030-12-25");
  });

  it("acepta validezPropuesta como string ISO (borrador rehidratado desde JSON)", () => {
    // Regresión v13.299.6: el draft de localStorage pasa por JSON.stringify,
    // que convierte Date → string. El mapper debe ser defensivo.
    const isoString = "2030-12-25T10:00:00.000Z" as unknown as Date;
    const r = buildPaso1Data(values({ validezPropuesta: isoString }), CLIENTES, "op@x");
    expect(r.validez_propuesta).toBe("2030-12-25");
  });

  it("incluye moneda USD, subtotal 0 y operador", () => {
    const r = buildPaso1Data(values(), CLIENTES, "vendor@x.com");
    expect(r.moneda).toBe("USD");
    expect(r.subtotal).toBe(0);
    expect(r.operador).toBe("vendor@x.com");
    expect(r.conceptos_venta).toEqual([]);
  });
});
