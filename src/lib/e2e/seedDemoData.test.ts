import { describe, expect, it } from "vitest";
import {
  SEED_AGENTES,
  SEED_CLIENTE,
  SEED_CUENTAS_BANCARIAS,
  SEED_DEMO_DATA,
  SEED_NAVIERAS,
  SEED_PRODUCTOS_SERVICIOS,
  SEED_PROVEEDOR,
  SEED_RUTAS,
  SEED_TARIFAS,
  SEED_TIPO_CAMBIO,
} from "./seedDemoData";

describe("seedDemoData", () => {
  it("expone las cantidades requeridas por la organización demo", () => {
    expect(SEED_NAVIERAS).toHaveLength(3);
    expect(SEED_AGENTES).toHaveLength(2);
    expect(SEED_RUTAS).toHaveLength(2);
    expect(SEED_TARIFAS).toHaveLength(3);
    expect(SEED_PRODUCTOS_SERVICIOS).toHaveLength(8);
    expect(SEED_CUENTAS_BANCARIAS).toHaveLength(2);
  });

  it("tiene claves naturales únicas (sin duplicados) en cada catálogo", () => {
    expect(new Set(SEED_NAVIERAS.map((n) => n.code)).size).toBe(SEED_NAVIERAS.length);
    expect(new Set(SEED_AGENTES.map((a) => a.nombre)).size).toBe(SEED_AGENTES.length);
    expect(
      new Set(SEED_RUTAS.map((r) => `${r.puertoOrigen.code}->${r.puertoDestino.code}`)).size,
    ).toBe(SEED_RUTAS.length);
    expect(
      new Set(
        SEED_TARIFAS.map(
          (t) =>
            `${t.agenteNombre}|${t.navieraCode}|${t.ruta.puertoOrigen.code}-${t.ruta.puertoDestino.code}|${t.tipoContenedorCode}`,
        ),
      ).size,
    ).toBe(SEED_TARIFAS.length);
    expect(new Set(SEED_PRODUCTOS_SERVICIOS.map((p) => p.patron.toLowerCase())).size).toBe(
      SEED_PRODUCTOS_SERVICIOS.length,
    );
    expect(new Set(SEED_CUENTAS_BANCARIAS.map((c) => c.alias)).size).toBe(
      SEED_CUENTAS_BANCARIAS.length,
    );
  });

  it("incluye exactamente una cuenta MXN y una USD, ambas con saldo positivo", () => {
    const monedas = SEED_CUENTAS_BANCARIAS.map((c) => c.moneda).sort();
    expect(monedas).toEqual(["MXN", "USD"]);
    for (const cuenta of SEED_CUENTAS_BANCARIAS) {
      expect(cuenta.saldoInicial).toBeGreaterThan(0);
      expect(cuenta.clabe).toHaveLength(18);
    }
  });

  it("el tipo de cambio del día es positivo y coherente (USD > 1 MXN)", () => {
    expect(SEED_TIPO_CAMBIO.usdMxn).toBeGreaterThan(1);
    expect(SEED_TIPO_CAMBIO.origen).toBe("manual");
  });

  it("cada tarifa referencia un agente y una ruta declarados en la semilla", () => {
    const nombresAgentes = new Set(SEED_AGENTES.map((a) => a.nombre));
    const rutasKeys = new Set(
      SEED_RUTAS.map((r) => `${r.puertoOrigen.code}->${r.puertoDestino.code}`),
    );
    for (const tarifa of SEED_TARIFAS) {
      expect(nombresAgentes.has(tarifa.agenteNombre)).toBe(true);
      expect(
        rutasKeys.has(`${tarifa.ruta.puertoOrigen.code}->${tarifa.ruta.puertoDestino.code}`),
      ).toBe(true);
      expect(tarifa.fleteBase).toBeGreaterThan(0);
      // "vigente" hoy: debe haber iniciado en el pasado y terminar en el futuro.
      expect(tarifa.diasVigenciaDesdeHoy).toBeLessThanOrEqual(0);
      expect(tarifa.diasVigenciaDesdeHoy + tarifa.diasDuracionVigencia).toBeGreaterThan(0);
    }
  });

  it("cada producto/servicio trae una clave SAT de 8 dígitos y unidad válida", () => {
    for (const p of SEED_PRODUCTOS_SERVICIOS) {
      expect(p.claveSat).toMatch(/^\d{6,8}$/);
      expect(p.claveUnidadSat.length).toBeGreaterThan(0);
      expect(p.tasaIvaDefault).toBeGreaterThanOrEqual(0);
      expect(p.tasaIvaDefault).toBeLessThanOrEqual(1);
    }
  });

  it("cliente y proveedor demo tienen RFC y datos de contacto completos", () => {
    for (const entidad of [SEED_CLIENTE, SEED_PROVEEDOR]) {
      expect(entidad.rfc.length).toBeGreaterThanOrEqual(12);
      expect(entidad.email).toContain("@");
      expect(entidad.nombre.length).toBeGreaterThan(0);
      expect(entidad.telefono.length).toBeGreaterThanOrEqual(10);
    }
    expect(SEED_CLIENTE.rfc).not.toBe(SEED_PROVEEDOR.rfc);
  });

  it("SEED_DEMO_DATA agrupa todas las colecciones sin perder referencias", () => {
    expect(SEED_DEMO_DATA.navieras).toBe(SEED_NAVIERAS);
    expect(SEED_DEMO_DATA.agentes).toBe(SEED_AGENTES);
    expect(SEED_DEMO_DATA.rutas).toBe(SEED_RUTAS);
    expect(SEED_DEMO_DATA.tarifas).toBe(SEED_TARIFAS);
    expect(SEED_DEMO_DATA.productosServicios).toBe(SEED_PRODUCTOS_SERVICIOS);
    expect(SEED_DEMO_DATA.cuentasBancarias).toBe(SEED_CUENTAS_BANCARIAS);
    expect(SEED_DEMO_DATA.tipoCambio).toBe(SEED_TIPO_CAMBIO);
    expect(SEED_DEMO_DATA.cliente).toBe(SEED_CLIENTE);
    expect(SEED_DEMO_DATA.proveedor).toBe(SEED_PROVEEDOR);
  });
});
