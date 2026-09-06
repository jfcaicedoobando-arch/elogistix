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
  const sqlCrm = readLatestMigrationWith(
    "CREATE OR REPLACE FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion",
  );

  it("aceptar_cotizacion_version valida estado y levanta LC_COTIZACION_ESTADO_INVALIDO", () => {
    expect(sqlAceptar).toMatch(/v_estado_actual\s+NOT IN\s*\(\s*'Borrador'\s*,\s*'Enviada'\s*\)/);
    expect(sqlAceptar).toMatch(/LC_COTIZACION_ESTADO_INVALIDO/);
    expect(sqlAceptar).toMatch(/estados_permitidos/);
  });

  it("aceptar_cotizacion_version bloquea la fila con FOR UPDATE antes de validar", () => {
    expect(sqlAceptar).toMatch(/FOR UPDATE/);
  });

  // v13.823.58 — reintento idempotente: la segunda llamada devuelve éxito con
  // `sin_cambios=true` y no reescribe sellos; un enlace ganador inconsistente
  // falla cerrado en lugar de "repararse" solo.
  it("aceptar_cotizacion_version soporta reintento idempotente", () => {
    expect(sqlAceptar).toMatch(/v_estado_actual IN \('Aceptada','En operación'\)/);
    expect(sqlAceptar).toMatch(/'sin_cambios', true/);
    expect(sqlAceptar).toMatch(/'sin_cambios',false/);
    expect(sqlAceptar).toMatch(/LC_COTIZACION_ACEPTACION_INCONSISTENTE/);
    expect(sqlAceptar).toMatch(/LC_COTIZACION_GANADORA_EXISTE/);
  });


  it("la autoridad única asigna valor_real y fecha de cierre en el primer cierre", () => {
    expect(sqlCrm).toMatch(/valor_real\s*=\s*NEW\.subtotal/);
    expect(sqlCrm).toMatch(/fecha_cierre_real\s*=\s*v_hoy/);
    expect(sqlCrm).toMatch(/cotizacion_ganadora_id\s*=\s*NEW\.id/);
  });

  it("no traga errores con EXCEPTION WHEN OTHERS", () => {
    expect(sqlCrm).not.toMatch(/WHEN\s+OTHERS/i);
  });

  it("registra auditoría del cambio de valor al re-aceptar", () => {
    expect(sqlCrm).toMatch(/oportunidad_ganada_revalorada/);
    expect(sqlCrm).toMatch(/valor_previo/);
    expect(sqlCrm).toMatch(/valor_nuevo/);
  });


  it("UI: CotizacionDetalleSecciones gatea 'Re-cotizar' con tieneEmbarquesVinculados", () => {
    const tsxPath = path.resolve(
      __dirname,
      "../../../src/features/cotizacion/components/CotizacionDetalleSecciones.tsx",
    );
    const domainPath = path.resolve(
      __dirname,
      "../../../src/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad.ts",
    );
    const src = fs.readFileSync(tsxPath, "utf8");
    // v13.823.153 — la regla vive en el módulo de dominio (refactor Power-of-10);
    // el componente sólo consume la bandera.
    const dominio = fs.readFileSync(domainPath, "utf8");
    expect(dominio).toMatch(/mostrarRecotizar\s*[:=]\s*esAceptada\s*&&\s*!tieneEmbarquesVinculados/);
    expect(src).toMatch(/\{mostrarRecotizar\s*&&/);
  });
});
