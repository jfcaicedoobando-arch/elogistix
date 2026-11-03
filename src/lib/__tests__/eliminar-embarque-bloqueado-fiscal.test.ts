/**
 * Guardrail Fase E (v13.301.74) — eliminar_embarque_completo con guardas fiscales.
 *
 * Blinda que la última migración que redefine `eliminar_embarque_completo`:
 *  - Delega al recolector canónico vigente, con ocho motivos documentales y estado cerrado.
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

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");
const FN = "public.eliminar_embarque_completo";

function migracionesOrdenadas(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Extrae los bloques `CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo`
 * de un SQL, respetando la etiqueta de dollar-quoting con la que abre el cuerpo
 * (`$$` o `$function$`) para no derramarse hacia funciones vecinas.
 */
function extraerDefiniciones(sql: string, fn: string): string[] {
  const out: string[] = [];
  const inicio = new RegExp(`CREATE OR REPLACE FUNCTION ${fn.replaceAll(".", "\\.")}\\s*\\(`, "g");
  for (const m of sql.matchAll(inicio)) {
    const desde = m.index ?? 0;
    const tag = /AS\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(desde));
    if (!tag) continue;
    const abre = desde + (tag.index ?? 0) + tag[0].length;
    const cierra = sql.indexOf(tag[1], abre);
    if (cierra === -1) continue;
    out.push(sql.slice(desde, cierra + tag[1].length));
  }
  return out;
}

/**
 * Auditoría de tests (v13.741.0): antes se concatenaban TODAS las definiciones
 * históricas, así que el guardrail pasaba aunque la versión vigente hubiera
 * perdido una guarda (bastaba con que una migración antigua la tuviera). Ahora
 * se lee sólo la ÚLTIMA definición — la vigente en la base de datos.
 */
function readDefinicionVigente(fn: string): string {
  for (const f of migracionesOrdenadas().reverse()) {
    const defs = extraerDefiniciones(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"), fn);
    if (defs.length > 0) return defs[defs.length - 1];
  }
  throw new Error(`No se encontró FUNCTION ${fn}`);
}

/** Los GRANT sobreviven a `CREATE OR REPLACE`, así que se buscan en todo el historial. */
function readGrants(): string {
  const re = new RegExp(`GRANT EXECUTE ON FUNCTION ${FN.replace(".", "\\.")}[^;]*;`, "g");
  return migracionesOrdenadas()
    .flatMap((f) => [...fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8").matchAll(re)])
    .map((m) => m[0])
    .join("\n");
}

describe("Fase E — eliminar_embarque_completo bloquea por dependencias fiscales", () => {
  const sql = readDefinicionVigente(FN);
  const collector = readDefinicionVigente("public._h14_dependencias_baja_embarque");
  const grants = readGrants();

  it("delega los ocho motivos al recolector vigente antes de decidir o modificar hijos", () => {
    expect(sql).toMatch(
      /v_motivos\s*:=\s*public\._h14_dependencias_baja_embarque\(p_embarque_id,\s*v_org,/,
    );
    expect(sql).toMatch(/IF \(v_motivos->>'bloqueado'\)::boolean IS TRUE THEN/);
    const read = sql.indexOf("public._h14_dependencias_baja_embarque(");
    const decision = sql.indexOf("IF (v_motivos->>'bloqueado')");
    expect(read).toBeLessThan(decision);
    expect(decision).toBeLessThan(sql.indexOf("UPDATE public."));
    // facturas vivas (excluye Cancelada|Sustituida). Tolerante a espacios.
    expect(collector).toMatch(
      /FROM public\.facturas f, factura_ids ids[\s\S]{0,200}f\.deleted_at IS NULL\s+AND f\.estado NOT IN \('Cancelada',\s*'Sustituida'\)/,
    );
    // proveedor_facturas vivas (la versión vigente cuenta toda CxP no borrada)
    expect(collector).toMatch(
      /FROM public\.proveedor_facturas f, cxp_ids ids[\s\S]{0,200}f\.deleted_at IS NULL/,
    );
    // pagos_factura y pagos_proveedor
    expect(collector).toMatch(/FROM public\.pagos_factura p, factura_ids ids[\s\S]{0,240}p\.factura_id = ANY\(ids\.ids\) OR p\.embarque_id = p_embarque_id[\s\S]{0,160}p\.deleted_at IS NULL/);
    expect(collector).toMatch(/FROM public\.pagos_proveedor p, cxp_ids ids[\s\S]{0,240}p\.proveedor_factura_id = ANY\(ids\.ids\)[\s\S]{0,160}p\.deleted_at IS NULL/);
    // notas de crédito CxC y CxP
    expect(collector).toMatch(/FROM public\.factura_notas_credito n, factura_ids ids[\s\S]{0,240}n\.deleted_at IS NULL/);
    expect(collector).toMatch(/FROM public\.proveedor_notas_credito n, cxp_ids ids[\s\S]{0,240}n\.deleted_at IS NULL/);
    // comisiones definitivas
    expect(collector).toMatch(/FROM public\.comisiones_devengadas c[\s\S]{0,120}c\.definitiva IS TRUE/);
    // proformas vivas, incluido borrador
    expect(collector).toMatch(/COALESCE\(p\.estado_proforma, 'pendiente'\) NOT IN \('cancelada', 'facturada'\)/);
  });

  it("bloquea con RAISE EXCEPTION + LC_EMBARQUE_BLOQUEADO + JSON en HINT", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO/);
    expect(sql).toMatch(/USING HINT = v_motivos::text/);
    // El HINT es el resultado del recolector; conserva las llaves previas y el contrato v1.
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
      "'proformas'",
      "'version'",
      "'embarque_id'",
      "'bloqueado'",
      "'ejemplos_cxc'",
      "'ejemplos_cxp'",
    ]) {
      expect(collector).toContain(key);
    }
  });

  it("incluye el estado 'Cerrado' o cerrado_at en la condición de bloqueo", () => {
    expect(collector).toMatch(/'cerrado', e\.estado = 'Cerrado' OR e\.cerrado_at IS NOT NULL/);
    const block = /'bloqueado',([\s\S]+?),\s*'ejemplos_cxc'/.exec(collector);
    expect(block).not.toBeNull();
    expect(block![1]).toContain("e.estado = 'Cerrado'");
    expect(block![1]).toContain("e.cerrado_at IS NOT NULL");
  });

  it("NUNCA borra facturas ni proveedor_facturas (fix Bug 7)", () => {
    // Blindaje explícito: si alguien restaura el cascade destructivo,
    // el test lo detecta antes de que llegue a producción.
    expect(sql).not.toMatch(/UPDATE public\.facturas\s+SET deleted_at/);
    expect(sql).not.toMatch(/UPDATE public\.proveedor_facturas\s+SET deleted_at/);
    expect(collector).not.toMatch(/\b(?:UPDATE|DELETE|INSERT)\b/);
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
      /UPDATE public\.cotizaciones[\s\S]{0,200}estado = 'Aceptada'[\s\S]{0,200}WHERE id = v_cotizacion_id/,
    );
  });

  it("otorga EXECUTE sólo a authenticated y service_role", () => {
    expect(grants).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.eliminar_embarque_completo\(uuid\) TO authenticated, service_role/,
    );
  });
});
