/**
 * M2 (auditoría de arquitectura 2026-07-29) — Ratchet de adopción de zod en
 * `fromDb`.
 *
 * `fromDb<T>(data)` es un cast crudo: si el shape de la fila cambia (columna
 * renombrada, `jsonb` malformado, monto nulo) el error aparece más tarde como
 * `undefined`/`NaN` en pantalla, sin traza. `fromDb(data, schema)` y
 * `fromDbChecked(data, schema)` validan en el boundary.
 *
 * Este test NO exige migrar todo de golpe: congela el conteo actual de casts
 * crudos por feature y falla solo si SUBE. Al migrar un call site hay que
 * bajar el número aquí (el test avisa cuando la baseline quedó holgada).
 */
import { describe, expect, it } from "vitest";
import { scanFromDbAdoption } from "../../../scripts/lib/fromDbAdoption";

/** Casts crudos `fromDb<T>(…)` permitidos por feature. Solo puede BAJAR. */
const BASELINE_SIN_SCHEMA: Record<string, number> = {
  admin: 6,
  auditoria: 1,
  catalogos: 3,
  configuracion: 4,
  cotizacion: 8,
  dashboard: 1,
  embarques: 4,
  operaciones: 1,
  portal: 2,
  proformas: 6,
  proveedor: 2,
  lib: 1,
};

describe("architecture: adopción de zod en fromDb (ratchet)", () => {
  const adopcion = scanFromDbAdoption(process.cwd());

  it("ninguna feature aumenta sus casts `fromDb` sin schema", () => {
    const subidas: string[] = [];
    for (const [feature, count] of Object.entries(adopcion.porFeature)) {
      const permitido = BASELINE_SIN_SCHEMA[feature] ?? 0;
      if (count > permitido) {
        subidas.push(`${feature}: ${count} > ${permitido} permitidos`);
      }
    }
    expect(
      subidas,
      `Nuevos \`fromDb<T>()\` sin validación runtime. Usa \`fromDb(data, schema)\` o \`fromDbChecked(data, schema)\`:\n${subidas.join("\n")}`,
    ).toEqual([]);
  });

  it("la baseline no quedó holgada tras migrar call sites", () => {
    const holgadas: string[] = [];
    for (const [feature, permitido] of Object.entries(BASELINE_SIN_SCHEMA)) {
      const count = adopcion.porFeature[feature] ?? 0;
      if (count < permitido) holgadas.push(`${feature}: ${count} real < ${permitido} baseline`);
    }
    expect(
      holgadas,
      `Baja la baseline en fromdb-zod-adoption.test.ts (el ratchet solo puede encoger):\n${holgadas.join("\n")}`,
    ).toEqual([]);
  });

  it("hay al menos un boundary de dinero validado", () => {
    expect(adopcion.conSchema).toBeGreaterThan(0);
  });
});
