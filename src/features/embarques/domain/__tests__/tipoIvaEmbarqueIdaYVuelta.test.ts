/**
 * SAT 01 — Viaje completo del tratamiento fiscal en "Ventas de embarques":
 * lectura de la fila guardada → edición de otro campo → payload de guardado.
 * Y guardas estáticas sobre la migración preparada (no se aplica aquí).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mapConceptoVentaDbAFila } from "@/features/embarques/domain/hidratarConceptoVenta";
import { buildConceptosVentaPayload } from "@/features/embarques/domain/mappers/embarqueToDbConceptos";

const MIGRACION = resolve(
  process.cwd(),
  "docs/migraciones-preparadas/20260918000100_iva_no_objeto_sat01.sql",
);

const FILA_DB_NO_OBJETO = {
  id: "11111111-1111-4111-8111-111111111111",
  descripcion: "Maniobras SAT 01",
  cantidad: 1,
  precio_unitario: "500.00",
  moneda: "MXN",
  contenedor_id: null,
  estado_facturacion: "pendiente",
  aplica_iva: false,
  tasa_iva_aplicada: null,
  tipo_iva: "no_objeto",
};

describe("Ventas de embarques — ida y vuelta de tipo_iva", () => {
  it("una fila SAT 01 se hidrata, se edita otro campo y sigue SAT 01 al guardar", () => {
    const fila = mapConceptoVentaDbAFila(FILA_DB_NO_OBJETO, 0);
    expect(fila.tipoIva).toBe("no_objeto");
    expect(fila.aplicaIva).toBe(false);
    expect(fila.dbId).toBe(FILA_DB_NO_OBJETO.id);

    // El usuario sólo cambia la cantidad.
    const editada = { ...fila, cantidad: 3 };
    const [payload] = buildConceptosVentaPayload([editada]);

    expect(payload.id).toBe(FILA_DB_NO_OBJETO.id);
    expect(payload.tipo_iva).toBe("no_objeto");
    expect(payload.aplica_iva).toBe(false);
    expect(payload.total).toBe(1500);
  });

  it("una fila legacy (tipo_iva NULL) no gana tratamiento explícito", () => {
    const fila = mapConceptoVentaDbAFila(
      { ...FILA_DB_NO_OBJETO, aplica_iva: true, tasa_iva_aplicada: "0.16", tipo_iva: null },
      0,
    );
    expect(fila.tipoIva).toBeNull();
    const [payload] = buildConceptosVentaPayload([fila]);
    expect("tipo_iva" in payload).toBe(false);
    expect(payload.tasa_iva_aplicada).toBe(0.16);
  });

  it("la lectura de conceptos_venta selecciona tipo_iva", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/features/embarques/services/queries/conceptos.ts"),
      "utf8",
    );
    expect(src).toMatch(/tasa_iva_aplicada, tipo_iva/);
  });
});

describe("Migración preparada — sección 6 (RPC de conceptos_venta)", () => {
  const sql = readFileSync(MIGRACION, "utf8");

  it("localiza cada RPC por firma exacta, nunca por nombre con LIMIT 1", () => {
    expect(sql).toMatch(/pg_get_function_identity_arguments\(p\.oid\) = v_args/);
    expect(sql).not.toMatch(/p\.proname = v_fn\s*\n\s*LIMIT 1/);
    expect(sql).toMatch(/parche ambiguo/);
  });

  it("las cuatro rutas de conceptos_venta reciben tipo_iva", () => {
    for (const fn of [
      "crear_embarque_completo",
      "actualizar_embarque_completo",
      "_crear_embarque_replicar_conceptos",
      "duplicar_embarque_completo",
    ]) {
      expect(sql).toContain(`'${fn}'`);
    }
    // Alta, edición, replicado y duplicado añaden la columna.
    expect(sql).toContain("aplica_iva, tasa_iva_aplicada, tipo_iva, organization_id)");
    expect(sql).toContain("tipo_iva = CASE");
    expect(sql).toContain("aplica_iva, tasa_iva_aplicada, tipo_iva, total, organization_id");
    expect(sql).toContain("aplica_iva, tipo_iva\\n    FROM conceptos_venta");
  });

  it("conserva el guard de ancla y verifica el resultado del parche", () => {
    expect(sql).toMatch(/Ancla no encontrada/);
    expect(sql).toMatch(/no conserva tipo_iva en conceptos_venta tras el parche/);
  });
});
