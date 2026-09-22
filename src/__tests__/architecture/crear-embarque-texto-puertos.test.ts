/**
 * P1-A / P1-B · Contrato estático de `crear_embarque_borrador_core`.
 *
 * El sandbox de vitest no ejecuta Postgres, así que se verifica el SQL canónico:
 *   P1-A — el texto capturado se conserva ÍNTEGRO (nunca el fragmento entre
 *          paréntesis) en marítimo legacy, aéreo y terrestre.
 *   P1-B — origen == destino lanza LC_COT_PUERTOS_IGUALES en lugar de borrar
 *          silenciosamente ambos IDs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL = readFileSync(
  resolve(__dirname, "../../../supabase/schema/embarques/crear_embarque_borrador_core.sql"),
  "utf8",
);

describe("crear_embarque_borrador_core · P1-A texto íntegro", () => {
  it("declara variables separadas para el texto crudo y el candidato de UN/LOCODE", () => {
    expect(SQL).toMatch(/v_origen_raw\s+text;/);
    expect(SQL).toMatch(/v_destino_raw\s+text;/);
    expect(SQL).toMatch(/v_origen_raw\s*:=\s*NULLIF\(btrim\(v_cot\.origen\),\s*''\)/);
    expect(SQL).toMatch(/v_destino_raw\s*:=\s*NULLIF\(btrim\(v_cot\.destino\),\s*''\)/);
  });

  it("marítimo legacy sin puerto resuelto conserva el texto completo (no 'Terminal Norte')", () => {
    expect(SQL).toMatch(/v_puerto_o\s*:=\s*COALESCE\(v_puerto_o,\s*v_origen_raw\)/);
    expect(SQL).toMatch(/v_puerto_d\s*:=\s*COALESCE\(v_puerto_d,\s*v_destino_raw\)/);
    expect(SQL).not.toMatch(/v_puerto_o\s*:=\s*COALESCE\(v_puerto_o,\s*v_origen_code\)/);
    expect(SQL).not.toMatch(/v_puerto_d\s*:=\s*COALESCE\(v_puerto_d,\s*v_destino_code\)/);
  });

  it("aéreo guarda el texto completo (\"Ciudad de México (MEX)\", no \"MEX\")", () => {
    expect(SQL).toMatch(/v_aero_o\s*:=\s*v_origen_raw;/);
    expect(SQL).toMatch(/v_aero_d\s*:=\s*v_destino_raw;/);
    expect(SQL).not.toMatch(/v_aero_[od]\s*:=\s*v_(origen|destino)_code/);
  });

  it("terrestre guarda el texto completo (\"Monterrey (Apodaca)\")", () => {
    expect(SQL).toMatch(/v_ciudad_o\s*:=\s*v_origen_raw;/);
    expect(SQL).toMatch(/v_ciudad_d\s*:=\s*v_destino_raw;/);
    expect(SQL).not.toMatch(/v_ciudad_[od]\s*:=\s*v_(origen|destino)_code/);
  });

  it("el candidato de UN/LOCODE sólo se usa para coincidencia exacta contra puertos.code", () => {
    const usos = SQL.match(/v_origen_code/g) ?? [];
    // declaración + asignación + guarda de NULL + comparación exacta
    expect(usos.length).toBeLessThanOrEqual(4);
    expect(SQL).toMatch(/upper\(btrim\(p\.code\)\)\s*=\s*upper\(btrim\(v_origen_code\)\)/);
  });
});

describe("crear_embarque_borrador_core · P1-B origen == destino", () => {
  it("lanza LC_COT_PUERTOS_IGUALES en vez de borrar ambos IDs", () => {
    expect(SQL).toMatch(/RAISE\s+EXCEPTION\s+'LC_COT_PUERTOS_IGUALES:/);
    expect(SQL).not.toMatch(/v_puerto_o_id\s*:=\s*NULL;\s*v_puerto_d_id\s*:=\s*NULL;\s*END IF;\s*\n\s*--\s*Texto/);
  });

  it("el mensaje indica la acción a tomar", () => {
    expect(SQL).toMatch(/corrige la ruta antes de crear el embarque/);
  });
});
