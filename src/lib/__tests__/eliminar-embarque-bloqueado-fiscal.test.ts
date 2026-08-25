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
function extraerDefiniciones(sql: string): string[] {
  const out: string[] = [];
  const inicio = new RegExp(`CREATE OR REPLACE FUNCTION ${FN.replace(".", "\\.")}`, "g");
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
function readDefinicionVigente(): string {
  for (const f of migracionesOrdenadas().reverse()) {
    const defs = extraerDefiniciones(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    if (defs.length > 0) return defs[defs.length - 1];
  }
  throw new Error(`No se encontró FUNCTION ${FN}`);
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
  const sql = readDefinicionVigente();
  const grants = readGrants();

  it("recolecta los 6 contadores + estado cerrado antes de decidir", () => {
    // facturas vivas (excluye Cancelada|Sustituida). Tolerante a espacios.
    expect(sql).toMatch(
      /FROM public\.facturas[\s\S]{0,200}estado NOT IN \('Cancelada',\s*'Sustituida'\)/,
    );
    // proveedor_facturas vivas (la versión vigente cuenta toda CxP no borrada)
    expect(sql).toMatch(
      /FROM public\.proveedor_facturas[\s\S]{0,200}deleted_at IS NULL/,
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
      /UPDATE public\.cotizaciones[\s\S]{0,200}estado = 'Aceptada'[\s\S]{0,200}WHERE id = v_cotizacion_id/,
    );
  });

  it("otorga EXECUTE sólo a authenticated y service_role", () => {
    expect(grants).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.eliminar_embarque_completo\(uuid\) TO authenticated, service_role/,
    );
  });
});
