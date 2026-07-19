/**
 * Guardrail Fase Q.1 (v13.301.90) — Portal cliente hardening.
 *
 * Blinda que:
 *  - `columns.ts` no exporte `deleted_at`/`deleted_by` en PORTAL_EVENTO/DOCUMENTO
 *  - `queries.ts` NO use `select("*")` (ni con espacios) y respete la whitelist
 *  - `fetchPortalEventos`/`fetchPortalDocumentos` filtren `deleted_at IS NULL`
 *  - `PORTAL_COTIZACION_DETAIL_COLUMNS` exista y NO liste campos sensibles
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, "features/portal/services", rel), "utf8");

describe("Fase Q.1 — Portal cliente whitelist (v13.301.90)", () => {
  const columns = readSrc("columns.ts");
  const queries = readSrc("queries.ts");

  it("PORTAL_EVENTO_COLUMNS no expone deleted_at ni deleted_by", () => {
    const m = columns.match(/PORTAL_EVENTO_COLUMNS\s*=\s*'([^']+)'/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/deleted_at/);
    expect(m![1]).not.toMatch(/deleted_by/);
  });

  it("PORTAL_DOCUMENTO_COLUMNS no expone deleted_at ni deleted_by", () => {
    const m = columns.match(/PORTAL_DOCUMENTO_COLUMNS\s*=\s*'([^']+)'/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toMatch(/deleted_at/);
    expect(m![1]).not.toMatch(/deleted_by/);
  });

  it("PORTAL_COTIZACION_DETAIL_COLUMNS existe y omite campos internos sensibles", () => {
    const m = columns.match(/PORTAL_COTIZACION_DETAIL_COLUMNS\s*=\s*'([^']+)'/);
    expect(m).toBeTruthy();
    const list = m![1];
    // Campos internos que no deben exponerse al cliente
    for (const forbidden of [
      "tarifa_id",
      "tarifa_override",
      "sin_desglose_costos",
      "aceptada_por",
      "operador",
      "deleted_by",
      "deleted_at",
      "oportunidad_id",
      "duplicada_de_id",
      "es_prospecto",
      "prospecto_email",
      "prospecto_telefono",
      "prospecto_contacto",
      "prospecto_empresa",
      "revalidacion_delta_jsonb",
      "revalidacion_solicitada_en",
      "revalidacion_resuelta_en",
      "estado_revalidacion",
      "estado_anterior",
      "lcl_consolidador_id",
    ]) {
      expect(list, `PORTAL_COTIZACION_DETAIL_COLUMNS no debe incluir '${forbidden}'`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`),
      );
    }
    // Campos que SÍ debe incluir (contrato con la UI)
    for (const required of [
      "folio",
      "cliente_nombre",
      "conceptos_venta",
      "modo",
      "estado",
      "moneda",
      "fecha_vigencia",
      "embarque_id",
      "comentario_cliente",
    ]) {
      expect(list, `PORTAL_COTIZACION_DETAIL_COLUMNS debe incluir '${required}'`).toMatch(
        new RegExp(`\\b${required}\\b`),
      );
    }
  });

  it("queries.ts no usa select('*') en el portal del cliente", () => {
    expect(queries).not.toMatch(/\.select\(\s*"\*"\s*\)/);
    expect(queries).not.toMatch(/\.select\(\s*'\*'\s*\)/);
  });

  it("fetchPortalEventos filtra deleted_at IS NULL", () => {
    const m = queries.match(/fetchPortalEventos[\s\S]*?PORTAL_RELATED_MAX\)/);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/\.is\(\s*"deleted_at"\s*,\s*null\s*\)/);
  });

  it("fetchPortalDocumentos filtra deleted_at IS NULL", () => {
    const m = queries.match(/fetchPortalDocumentos[\s\S]*?PORTAL_RELATED_MAX\)/);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/\.is\(\s*"deleted_at"\s*,\s*null\s*\)/);
  });

  it("fetchPortalCotizacion usa PORTAL_COTIZACION_DETAIL_COLUMNS (no select all)", () => {
    const m = queries.match(/export async function fetchPortalCotizacion[\s\S]*?maybeSingle\(\)/);
    expect(m).toBeTruthy();
    expect(m![0]).toMatch(/PORTAL_COTIZACION_DETAIL_COLUMNS/);
  });
});
