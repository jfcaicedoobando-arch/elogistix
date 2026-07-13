/**
 * Guardrail Papelera (v13.290.0):
 * Prohíbe `supabase.from("<tabla_soft>").delete()` en servicios/hooks.
 * Las tablas soft-delete deben eliminarse vía RPC `soft_delete_record` o RPCs
 * de dominio (`eliminar_embarque_completo`, etc.) para que aparezcan en la
 * papelera y sean recuperables desde `/admin/papelera`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SOFT_DELETE_TABLES = [
  "clientes", "contactos_cliente", "embarques", "documentos_embarque",
  "eventos_embarque", "notas_embarque", "cotizaciones", "cotizacion_costos",
  "facturas", "conceptos_factura", "proformas", "proforma_conceptos_consolidados",
  "conceptos_costo", "conceptos_venta",
  "crm_leads", "crm_oportunidades", "crm_actividades", "crm_comentarios_oportunidad",
  "crm_etapas_pipeline", "crm_motivos_perdida", "crm_plantillas_mensaje",
  "pagos_factura", "pagos_proveedor", "proveedor_facturas",
  "proveedor_notas_credito", "factura_notas_credito", "cuentas_bancarias",
  "seguros_embarque", "embarque_contenedores",
];

// Excepciones deliberadas (patrones de auto-regeneración o rollback interno,
// no eliminación iniciada por usuario). Cada excepción va con SAFE-CAST-like
// justificación.
const EXCEPTIONS = new Set<string>([
  // Regeneración periódica de demoras automáticas: los conceptos con
  // origen='demoras_auto' se recrean al recalcular, no son "papelerables".
  "src/features/embarques/services/demorasEmbarque.ts",
  // Rollback interno del flujo de creación manual: la factura nunca llegó a
  // existir como registro entregado al usuario.
  "src/features/facturacion/services/facturaManual.ts",
]);

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "__tests__" || name === "test" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("architecture: papelera no-hard-delete", () => {
  it("no hay `.from(\"<soft>\").delete()` fuera de excepciones", () => {
    const files = walk(SRC);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(process.cwd(), file);
      if (EXCEPTIONS.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const t of SOFT_DELETE_TABLES) {
        const re = new RegExp(
          String.raw`\.from\(\s*["'\`]${t}["'\`]\s*\)[\s\S]{0,400}?\.delete\s*\(`,
          "m",
        );
        if (re.test(src)) offenders.push(`${rel} → tabla "${t}"`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
