/**
 * Guardrail Fase E (v13.301.74) — eliminar_embarque_completo con guardas fiscales.
 *
 * Blinda que la última migración que redefine `eliminar_embarque_completo`:
 *  - Recolecta los 6 contadores de dependencias fiscales + estado cerrado.
 *  - Levanta `RAISE EXCEPTION` con el marcador `LC_EMBARQUE_BLOQUEADO` y
 *    JSON de motivos en el `HINT`.
 *  - No borra `facturas` ni `proveedor_facturas` (nunca) — el cascade viejo
 *    era el bug 7 de la auditoría.
 *  - Registra el borrado en `bitacora_actividad`.
 *  - Mantiene la reversión de `cotizaciones.estado = 'Aceptada'`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readAllEliminarEmbarqueMigrations(): string {
  // Extraemos SÓLO los bloques que definen `public.eliminar_embarque_completo`
  // (desde `CREATE OR REPLACE FUNCTION ...` hasta la sentencia `$$;` de cierre,
  // más los GRANT y COMMENT ON FUNCTION inmediatos). Concatenar migraciones
  // enteras contaminaría con código de funciones vecinas (p.ej. restaurar_embarque).
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const blocks: string[] = [];
  const fnRegex =
    /CREATE OR REPLACE FUNCTION public\.eliminar_embarque_completo[\s\S]*?\$\$;/g;
  const grantRegex =
    /GRANT EXECUTE ON FUNCTION public\.eliminar_embarque_completo[^;]*;/g;
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of body.matchAll(fnRegex)) blocks.push(m[0]);
    for (const m of body.matchAll(grantRegex)) blocks.push(m[0]);
  }
  if (blocks.length === 0) {
    throw new Error("No se encontró FUNCTION public.eliminar_embarque_completo");
  }
  return blocks.join("\n\n-- ── siguiente bloque ──\n\n");
}

describe("Fase E — eliminar_embarque_completo bloquea por dependencias fiscales", () => {
  const sql = readAllEliminarEmbarqueMigrations();

  it("recolecta los 6 contadores + estado cerrado antes de decidir", () => {
    // facturas vivas (excluye Cancelada|Sustituida). Tolerante a espacios.
    expect(sql).toMatch(
      /FROM public\.facturas[\s\S]{0,200}estado NOT IN \('Cancelada',\s*'Sustituida'\)/,
    );
    // proveedor_facturas vivas
    expect(sql).toMatch(
      /FROM public\.proveedor_facturas[\s\S]{0,200}estado <> 'Cancelada'/,
    );
    // pagos_factura y pagos_proveedor
    expect(sql).toMatch(/FROM public\.pagos_factura pf[\s\S]{0,120}JOIN public\.facturas/);
    expect(sql).toMatch(/FROM public\.pagos_proveedor pp[\s\S]{0,120}JOIN public\.proveedor_facturas/);
    // notas de crédito CxC y CxP
    expect(sql).toMatch(/FROM public\.factura_notas_credito nc/);
    expect(sql).toMatch(/FROM public\.proveedor_notas_credito nc/);
    // comisiones definitivas
    expect(sql).toMatch(/FROM public\.comisiones_devengadas[\s\S]{0,80}definitiva = true/);
  });

  it("bloquea con RAISE EXCEPTION + LC_EMBARQUE_BLOQUEADO + JSON en HINT", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO/);
    expect(sql).toMatch(/USING HINT = v_motivos::text/);
    // El JSON de motivos debe exponer las 9 llaves que consume el cliente.
    for (const key of [
      "'facturas'",
      "'cxp'",
      "'pagos_cxc'",
      "'pagos_cxp'",
      "'notas_credito_cxc'",
      "'notas_credito_cxp'",
      "'comisiones_definitivas'",
      "'cerrado'",
      "'expediente'",
    ]) {
      expect(sql).toContain(key);
    }
  });

  it("incluye el estado 'Cerrado' o cerrado_at en la condición de bloqueo", () => {
    expect(sql).toMatch(/v_estado = 'Cerrado'/);
    expect(sql).toMatch(/v_cerrado_at IS NOT NULL/);
  });

  it("NUNCA borra facturas ni proveedor_facturas (fix Bug 7)", () => {
    // Blindaje explícito: si alguien restaura el cascade destructivo,
    // el test lo detecta antes de que llegue a producción.
    expect(sql).not.toMatch(/UPDATE public\.facturas\s+SET deleted_at/);
    expect(sql).not.toMatch(/UPDATE public\.proveedor_facturas\s+SET deleted_at/);
  });

  it("soft-deletea sólo los hijos operativos + el embarque padre", () => {
    for (const tbl of [
      "conceptos_venta",
      "conceptos_costo",
      "documentos_embarque",
      "notas_embarque",
      "eventos_embarque",
      "embarque_contenedores",
      "seguros_embarque",
      "embarques",
    ]) {
      expect(sql).toMatch(new RegExp(`UPDATE public\\.${tbl}\\s+SET deleted_at`));
    }
  });

  it("registra la eliminación en bitacora_actividad", () => {
    expect(sql).toMatch(
      /INSERT INTO public\.bitacora_actividad[\s\S]{0,400}'eliminar_embarque'/,
    );
  });

  it("mantiene la reversión de cotización cuando no quedan embarques vivos", () => {
    expect(sql).toMatch(
      /UPDATE public\.cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id/,
    );
  });

  it("otorga EXECUTE sólo a authenticated y service_role", () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.eliminar_embarque_completo\(uuid\) TO authenticated, service_role/,
    );
  });
});
