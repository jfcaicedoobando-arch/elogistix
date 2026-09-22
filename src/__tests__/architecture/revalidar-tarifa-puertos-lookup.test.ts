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

  it("consulta public.puertos usando la columna real `code` (respaldo legacy)", () => {
    // Etapa 3: el UN/LOCODE dejó de ser la vía principal (ahora manda el ID de
    // catálogo), pero sigue siendo el ÚNICO respaldo para cotizaciones legacy.
    expect(sql).toMatch(/FROM\s+public\.puertos\s+p\b[\s\S]*?WHERE\s+upper\(btrim\(p\.code\)\)\s*=/i);
  });

  it("Etapa 3 · resuelve el puerto por ID de catálogo y sin `LIMIT 1` por nombre", () => {
    expect(sql).toMatch(/v_puerto_o_id\s*:=\s*v_cot\.puerto_origen_id\b/);
    expect(sql).toMatch(/v_puerto_d_id\s*:=\s*v_cot\.puerto_destino_id\b/);
    expect(sql).toMatch(/WHERE\s+p\.id\s*=\s*v_puerto_o_id\b/);
    // El respaldo por UN/LOCODE exige unicidad, nunca "el primero que aparezca".
    expect(sql).toMatch(/HAVING\s+count\(\*\)\s*=\s*1/i);
    expect(sql).not.toMatch(/WHERE\s+p\.code\s*=\s*v_(origen|destino)_code\s*LIMIT\s+1/i);
  });

  it("Etapa 3 · persiste los IDs de puerto en el embarque", () => {
    expect(sql).toMatch(/puerto_origen_id,\s*puerto_destino_id/);
    expect(sql).toMatch(/v_puerto_o_id,\s*v_puerto_d_id/);
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

  // v13.320.4: la columna real es `cotizaciones.tipo_contenedor` (text).
  // `tipo_contenedor_id` nunca existió; bloquear su reintroducción.
  it("no referencia la columna fantasma `tipo_contenedor_id` de cotizaciones", () => {
    expect(sql).not.toMatch(/\bv_cot\.tipo_contenedor_id\b/);
    expect(sql).not.toMatch(/\bcotizaciones\.tipo_contenedor_id\b/);
  });

  it("usa la columna real `v_cot.tipo_contenedor` para resolver el código de contenedor", () => {
    expect(sql).toMatch(/v_tipo_cont_code\s*:=\s*v_cot\.tipo_contenedor\b/);
  });
});
