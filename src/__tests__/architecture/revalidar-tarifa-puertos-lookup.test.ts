/**
 * Regresión: el RPC `crear_embarque_borrador_core` (invocado desde el flujo de
 * revalidar tarifa en /cotizaciones vía `crear_embarque_borrador_desde_cotizacion`)
 * DEBE resolver el nombre del puerto usando las columnas reales de la tabla
 * `public.puertos`: `code` (UN/LOCODE) y `name`.
 *
 * Bug histórico (v13.319.2/3): la función referenciaba `p.nombre` / `p.unlocode`,
 * que no existen, y hacía fallar toda la revalidación con
 *   "column p.nombre does not exist" / "record v_cot has no field puerto_origen"
 *
 * Este test bloquea cualquier regresión que renombre `puertos.code`/`puertos.name`
 * o que rompa el JOIN sin actualizar el schema canónico.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_PATH = resolve(
  __dirname,
  "../../../supabase/schema/embarques/crear_embarque_borrador_core.sql",
);

describe("crear_embarque_borrador_core · puertos lookup (regresión revalidar tarifa)", () => {
  const sql = readFileSync(SCHEMA_PATH, "utf8");

  it("consulta public.puertos usando la columna real `code`", () => {
    // Debe existir al menos una consulta con `WHERE p.code =` sobre `public.puertos p`.
    expect(sql).toMatch(/FROM\s+public\.puertos\s+p\b[\s\S]*?WHERE\s+p\.code\s*=/i);
  });

  it("selecciona el nombre del puerto usando la columna real `name`", () => {
    expect(sql).toMatch(/SELECT\s+p\.name\s+INTO\s+v_puerto_[od]/i);
  });

  it("no referencia columnas legacy inexistentes (`p.nombre`, `p.unlocode`)", () => {
    expect(sql).not.toMatch(/\bp\.nombre\b/);
    expect(sql).not.toMatch(/\bp\.unlocode\b/);
  });

  it("cubre tanto origen como destino en la resolución de puertos", () => {
    const matches = sql.match(/SELECT\s+p\.name\s+INTO\s+v_puerto_[od]/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
