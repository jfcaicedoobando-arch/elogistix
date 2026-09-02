/**
 * Guardrail Fase J (v13.301.81, actualizado en v13.823.57) — ciclo de
 * cotización correcto.
 *
 * Blinda:
 *  - `aceptar_cotizacion_version` valida `estado IN ('Borrador','Enviada')` y levanta
 *    `LC_COTIZACION_ESTADO_INVALIDO` para cualquier otro estado.
 *  - v13.823.57: la autoridad única `crm_cerrar_oportunidad_desde_cotizacion`
 *    fija `valor_real = NEW.subtotal` en el primer cierre y registra auditoría
 *    del cambio de valor al re-aceptar (sin `EXCEPTION WHEN OTHERS`).
 *  - UI: `CotizacionDetalleSecciones` oculta "Re-cotizar" cuando `tieneEmbarquesVinculados`.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestMigrationWith(marker: string): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marcador: ${marker}`);
}

describe("Fase J — ciclo de cotización", () => {
  const sqlAceptar = readLatestMigrationWith("CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version");
  const sqlCrm = readLatestMigrationWith("CREATE OR REPLACE FUNCTION public.crm_set_valor_real_on_aceptada");

  it("aceptar_cotizacion_version valida estado y levanta LC_COTIZACION_ESTADO_INVALIDO", () => {
    expect(sqlAceptar).toMatch(/v_estado_actual\s+NOT IN\s*\(\s*'Borrador'\s*,\s*'Enviada'\s*\)/);
    expect(sqlAceptar).toMatch(/LC_COTIZACION_ESTADO_INVALIDO/);
    expect(sqlAceptar).toMatch(/estados_permitidos/);
  });

  it("crm_set_valor_real_on_aceptada asigna valor_real y fecha_cierre_real incondicional", () => {
    // Debe existir `SET valor_real = NEW.subtotal` sin COALESCE
    expect(sqlCrm).toMatch(/SET\s+valor_real\s*=\s*NEW\.subtotal/);
    expect(sqlCrm).toMatch(/fecha_cierre_real\s*=\s*CURRENT_DATE/);
    // No debe seguir usando COALESCE para preservar el valor previo
    const fnBody = sqlCrm
      .split("CREATE OR REPLACE FUNCTION public.crm_set_valor_real_on_aceptada")[1]
      ?.split("$$;")[0] ?? "";
    expect(fnBody).not.toMatch(/COALESCE\(\s*valor_real\s*,\s*NEW\.subtotal\s*\)/);
  });

  it("registra bitácora crm.oportunidad.valor_real_actualizado", () => {
    expect(sqlCrm).toMatch(/crm\.oportunidad\.valor_real_actualizado/);
    expect(sqlCrm).toMatch(/valor_previo/);
    expect(sqlCrm).toMatch(/valor_nuevo/);
  });

  it("UI: CotizacionDetalleSecciones gatea 'Re-cotizar' con tieneEmbarquesVinculados", () => {
    const tsxPath = path.resolve(
      __dirname,
      "../../../src/features/cotizacion/components/CotizacionDetalleSecciones.tsx",
    );
    const src = fs.readFileSync(tsxPath, "utf8");
    // v13.624.5 — la bandera puede declararse como `const` o como propiedad del
    // objeto que devuelve `visibilidadAcciones` (refactor Power-of-10).
    expect(src).toMatch(/mostrarRecotizar\s*[:=]\s*esAceptada\s*&&\s*!tieneEmbarquesVinculados/);
    expect(src).toMatch(/\{mostrarRecotizar\s*&&/);
  });
});
