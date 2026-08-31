/**
 * Auditoría de higiene de migraciones SQL.
 * Uso: `bun run audit:migrations`
 *
 * Regla base: sólo se aplican los checks a migraciones **nuevas** (timestamp
 * >= BASELINE). El historial legacy tiene violaciones documentadas que no
 * podemos reescribir sin refactor de esquema; el auditor sirve para prevenir
 * regresiones hacia adelante.
 *
 * Checks:
 *  H1  Nombre de archivo: `YYYYMMDDHHMMSS_snake_case.sql` (uuid tras `_` ok).
 *  H2  `CREATE TABLE ... public.<t>` DEBE ir acompañado en el mismo archivo
 *      de al menos un `GRANT ... ON ... public.<t>` (contrato Data API).
 *  H3  `DROP FUNCTION|TABLE|VIEW ... CASCADE` DEBE ir seguido en el mismo
 *      archivo por `CREATE OR REPLACE FUNCTION|VIEW` o `CREATE TABLE` para
 *      la misma entidad (recreación explícita).
 *  H4  `CREATE INDEX` / `CREATE POLICY` DEBEN usar `IF NOT EXISTS`
 *      (idempotencia). NB: Postgres no soporta `CREATE POLICY IF NOT EXISTS`
 *      antes de PG16; se acepta también `DROP POLICY IF EXISTS ... ; CREATE POLICY`.
 *  H5  Prohibido `DROP TABLE public.*` sin `IF EXISTS`.
 *  H9  Prohibido parchear funciones por texto (`replace(pg_get_functiondef(...))`).
 *      Regla dura: aplica también a legacy (auditoría 3 · M6).
 *  H6  Toda `CREATE OR REPLACE FUNCTION public.<f>(...) ... SECURITY DEFINER`
 *      DEBE ir acompañada en el mismo archivo de:
 *        - `REVOKE ALL ON FUNCTION public.<f>(<args>) FROM PUBLIC` (o `FROM PUBLIC, anon`)
 *        - `GRANT EXECUTE ON FUNCTION public.<f>(<args>) TO <rol>` con rol ∈
 *          {authenticated, service_role, postgres}. Prohibido `TO PUBLIC`.
 *      Excepción: comentario `-- audit:allow-no-grants` justo antes del
 *      `CREATE OR REPLACE FUNCTION` (helpers privados sin exposición externa).
 *      La regla `GRANT EXECUTE ... TO PUBLIC` sobre SECURITY DEFINER es dura
 *      y aplica siempre (aun a legacy pre-baseline).
 *
 * Salida: exit 0 si limpio, 1 si hay violaciones (con listado agrupado).
 */
import fs from "node:fs";
import path from "node:path";
import {
  scanSecurityDefiner,
  scanBackfillTenantGuard,
  type Violation,
} from "./lib/audit-sql-signatures";


const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
/**
 * Fecha de corte: sólo auditamos migraciones creadas a partir de este
 * timestamp. Las migraciones ya aplicadas no son editables, por lo que el
 * legacy se cierra en el baseline y se corrige en BD con una migración
 * posterior. Bump manual cuando aparezca legacy imposible de corregir;
 * nunca a la baja.
 *
 * Historial de bumps:
 *  - `20260723223436` — snapshot post-FIX-H6-01 (REVOKE/GRANT de
 *    `guard_pago_proveedor` y `_crear_embarque_replicar_conceptos`).
 *  - `20260725184834` — snapshot intermedio.
 *  - `20260729170000` — post-FIX-H6-02: `20260729164301` recreó
 *    `convertir_proformas_a_factura` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. Los permisos en BD ya eran correctos
 *    (`proacl` sin PUBLIC) y quedan re-aplicados explícitamente por la
 *    migración FIX-H6-02 posterior.
 *  - `20260731220419` — post-FIX-H6-05: `20260731220418` (estado
 *    `Por liquidar`) recreó `embarque_operativo_completo`,
 *    `promover_embarque_por_liquidar`, `_trg_promover_por_liquidar`,
 *    `_trg_autocierre_por_liquidar`, `avanzar_estado_embarque`,
 *    `cerrar_embarque` y `reabrir_embarque` sin el bloque REVOKE/GRANT en el
 *    mismo archivo. La migración correctiva `20260731224126` re-aplica los
 *    permisos (`REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO
 *    authenticated, service_role`); el archivo original queda como legacy
 *    auditado.
 *  - `20260801011206` — post-FIX-H6-06: `20260801005827` (exclusión
 *    `sin_comision`) recreó `resolver_sin_comision` y
 *    `calcular_comision_pago` (SECURITY DEFINER) sin el bloque REVOKE/GRANT
 *    completo en el mismo archivo. La migración correctiva `20260801011206`
 *    re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon` +
 *    `GRANT EXECUTE … TO authenticated, service_role`); el archivo original
 *    queda como legacy auditado.
 *  - `20260804020030` — post-FIX-H6-07: `20260803214601` (cast de
 *    `tipo_operacion` en `generar_expediente`) recreó `avanzar_estado_embarque`
 *    y `20260804015413` creó el trigger `trg_notificar_cotizacion_enviada`,
 *    ambos SECURITY DEFINER sin el bloque REVOKE/GRANT en el mismo archivo.
 *    La migración correctiva `20260804020030` re-aplica los permisos
 *    (`REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated,
 *    service_role`); los archivos originales quedan como legacy auditados.
 *  - `20260806224435` — post-FIX-H6-08/H4-08: `20260806181358` (anticipos a
 *    proveedor), `20260806215835` (`conciliacion_resumen`), `20260806223611`
 *    (pago en lote) y `20260806201559` (políticas de `puertos`) omitieron el
 *    bloque REVOKE/GRANT y el `DROP POLICY IF EXISTS` / `IF NOT EXISTS` en el
 *    mismo archivo. La migración correctiva `20260806224435` re-aplica los
 *    permisos y re-crea políticas e índices de forma idempotente; los
 *    archivos originales quedan como legacy auditados.
 *  - `20260807172302` — post-FIX-H6-09/H4-09: `20260807145542` (optimización
 *    RLS con `has_any_role`) recreó `public.has_role` sin el bloque
 *    REVOKE/GRANT y creó 24 policies sin `DROP POLICY IF EXISTS` del mismo
 *    nombre. La migración correctiva `20260807172302` re-aplica los permisos
 *    de `has_role` / `has_any_role`; las policies ya quedaron creadas en BD
 *    con los predicados correctos y el archivo original queda como legacy
 *    auditado.
 *  - `20260807212604` — post-FIX-H6-10: las migraciones de bitácora
 *    (`20260807211258` cierre/reapertura de embarque, `20260807211728`
 *    archivado de versiones, `20260807212033` cambios de rol y
 *    `20260807212343` estado de facturas) recrearon funciones
 *    SECURITY DEFINER sin el bloque REVOKE/GRANT en el mismo archivo. Las
 *    migraciones correctivas `20260807212527` y `20260807212604` re-aplican
 *    los permisos (`REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO
 *    authenticated, service_role` / `service_role` para las de trigger); los
 *    archivos originales quedan como legacy auditados.
 *  - `20260810053328` — post-FIX-H6-11: `20260810052424` (Ola 3 de
 *    regresiones) recreó `convertir_prospecto_a_cliente_rpc` (SECURITY
 *    DEFINER) sin el bloque REVOKE/GRANT en el mismo archivo. La migración
 *    correctiva `20260810053328` re-aplica los permisos (`REVOKE ALL … FROM
 *    PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role`); el
 *    archivo original queda como legacy auditado.
 *  - `20260810204343` — post-FIX-H6-12: `20260810195819` recreó
 *    `assert_movimiento_pago_consistente()` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260810204343` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon`
 *    + `GRANT EXECUTE … TO authenticated, service_role`); el archivo original
 *    queda como legacy auditado.
 *  - `20260810235028` — post-FIX-H6-13: `20260810233441` (rechazo de factura
 *    de proveedor libera el costo) recreó `_cxp_desvincular_por_rechazo` sin
 *    `GRANT EXECUTE … TO service_role` y `aprobar_factura_proveedor` sin
 *    `REVOKE ALL … FROM PUBLIC`. La migración correctiva `20260810235028`
 *    re-aplica ambos bloques; los archivos originales quedan como legacy
 *    auditados.
 *  - `20260812184448` — post-FIX-H6-14: `20260812175701` recreó
 *    `siguiente_folio_proveedor(uuid)` (SECURITY DEFINER) con GRANT pero sin
 *    `REVOKE ALL … FROM PUBLIC`. La migración correctiva `20260812184448`
 *    re-aplica el bloque canónico; el archivo original queda como legacy
 *    auditado.
 *  - `20260812205800` — post-FIX-H6-15: `20260812192954` recreó
 *    `get_tracking_public(text)` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260812205800` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC` +
 *    `GRANT EXECUTE … TO anon, authenticated, service_role`; el enlace
 *    público de rastreo requiere ejecución por `anon`); el archivo original
 *    queda como legacy auditado.
 *  - `20260813003652` — post-FIX-H6-16: `20260813002242` recreó
 *    `pnl_financiero_embarque(uuid)` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260813003652` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC` +
 *    `GRANT EXECUTE … TO authenticated, service_role`); el archivo original
 *    queda como legacy auditado.
 *  - `20260813025019` — post-FIX-H6-17: `20260813025018` (Sprint 04, guardia
 *    de moneda de cuentas bancarias) creó `guard_cuenta_bancaria_moneda()`
 *    (SECURITY DEFINER, función de trigger) sin el bloque REVOKE/GRANT en el
 *    mismo archivo. La migración correctiva `20260813031718` re-aplica los
 *    permisos (`REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO
 *    authenticated, service_role`); el archivo original queda como legacy
 *    auditado.
 *  - `20260814164034` — post-FIX-H6-18: `20260814161725` y `20260814163218`
 *    (Ola 14, borrado lógico estricto en reportes) re-emitieron
 *    `libro_pagos`, `estado_cuenta_bancario`, `conciliacion_resumen`,
 *    `pnl_financiero_embarque`, `proveedor_estado_cuenta`,
 *    `proveedor_estado_cuenta_movimientos`, `cxc_aging_clientes` y
 *    `cxp_aging_proveedores` (SECURITY DEFINER) sin el bloque REVOKE/GRANT en
 *    el mismo archivo. La migración correctiva `20260814164034` re-aplica los
 *    permisos (`REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated,
 *    service_role`); los archivos originales quedan como legacy auditado. Los
 *    replays `20260824080000` / `20260824080100` sí incluyen el bloque y siguen
 *    dentro del alcance de la auditoría.
 *  - post-FIX-H6-19: `20260814174632` (Ola 16) re-emitió las RPCs de papelera
 *    y bitácora (`list_trash`, `list_trash_counts`, `restore_record`,
 *    `purge_record`, `soft_delete_record`, `list_idempotency_log`) sin el
 *    bloque REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260814185046` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon`
 *    + `GRANT EXECUTE … TO authenticated, service_role`); el archivo original
 *    queda como legacy auditado.
 *  - `20260814224500` — post-FIX-H6-20: `20260814221719` ("clientes de casa")
 *    creó `aceptar_cotizacion_version` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260814224500` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon`
 *    + `GRANT EXECUTE … TO authenticated, service_role`); el archivo original
 *    queda como legacy auditado.
 *  - `20260826000700` — post-FIX-H6-21 (Ola D): `20260826000200` (BUG-13
 *    umbral de cierre por moneda), `20260826000300` / `20260826000301`
 *    (BUG-17 totales por renglón), `20260826000400` (BUG-10 guarda optimista)
 *    y `20260826000600` (BUG-15 tolerancia de sobrepago) re-emitieron
 *    `validar_cierre_embarque`, `_convertir_proformas_insertar_conceptos`,
 *    `convertir_proformas_a_factura`, `avanzar_estado_embarque` y
 *    `registrar_pago_cliente_lote` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260826000700` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon`
 *    + `GRANT EXECUTE … TO authenticated, service_role`); los archivos
 *    originales quedan como legacy auditado.
 *  - `20260901002100` — post-FIX-H6-22: `20260826030340` y
 *    `20260901001500` (bitácora con actor de sesión) re-emitieron
 *    `reabrir_embarque` y `20260901001400` (remediación selectiva QA)
 *    re-emitió `avanzar_estado_embarque` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. La migración correctiva
 *    `20260901002100` re-aplica los permisos (`REVOKE ALL … FROM PUBLIC, anon`
 *    + `GRANT EXECUTE … TO authenticated, service_role`); los archivos
 *    originales quedan como legacy auditado.
 *  - `20260907000000` — post-FIX-H6-23 (antes `20260908000000`; se bajó al
 *    eliminar la migración duplicada YG-02 con timestamp futuro: la única
 *    migración YG-02 vigente es `20260831211719`, que sí incluye el bloque
 *    REVOKE/GRANT canónico y fue revisada a mano): las migraciones inmutables
 *    `20260905000100_ola7_v15_m1_m8_m10_n1.sql`,
 *    `20260905000200_ola8_v15_candados.sql` y
 *    `20260906000000_ola1_reabrir_y_cancelar_liquidacion.sql` crearon
 *    funciones `SECURITY DEFINER` sin el bloque REVOKE/GRANT canónico.
 *    La migración correctiva re-aplica los permisos; los archivos originales
 *    quedan como legacy auditado.
 */
const BASELINE = "20260907000000";



export const FNAME_RE = /^(\d{14})_[a-z0-9_-]+\.sql$/;

export type { Violation };

export function scanFile(file: string, body: string, auditPostBaseline = true): Violation[] {
  const out: Violation[] = [];

  // H2 — CREATE TABLE public.X requiere GRANT ... public.X
  const createTableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  const tables = new Set<string>();
  for (const m of body.matchAll(createTableRe)) tables.add(m[1].toLowerCase());
  for (const t of tables) {
    const grantRe = new RegExp(`grant\\s+[^;]+on\\s+(?:table\\s+)?public\\.${t}\\b`, "i");
    if (!grantRe.test(body)) {
      out.push({ file, check: "H2", detail: `public.${t} sin GRANT en el mismo archivo` });
    }
  }

  // H3 — DROP ... CASCADE requiere recreación en el mismo archivo
  const dropCascadeRe =
    /drop\s+(function|table|view)\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)[^;]*cascade/gi;
  for (const m of body.matchAll(dropCascadeRe)) {
    const kind = m[1].toLowerCase();
    const name = m[2].toLowerCase();
    const recreateRe =
      kind === "table"
        ? new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${name}\\b`, "i")
        : kind === "view"
          ? new RegExp(`create\\s+(?:or\\s+replace\\s+)?view\\s+public\\.${name}\\b`, "i")
          : new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`, "i");
    if (!recreateRe.test(body)) {
      out.push({
        file,
        check: "H3",
        detail: `DROP ${kind.toUpperCase()} public.${name} CASCADE sin recreación`,
      });
    }
  }

  // H4a — CREATE INDEX sin IF NOT EXISTS
  // Se ignoran los comentarios de línea (`-- ...`): una migración puede
  // documentar en prosa por qué NO crea un índice sin ser una violación.
  const bodySinComentarios = body.replace(/--[^\n]*/g, "");
  const idxRe = /create\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)([a-z0-9_]+)/gi;
  for (const m of bodySinComentarios.matchAll(idxRe)) {
    out.push({ file, check: "H4", detail: `CREATE INDEX ${m[1]} sin IF NOT EXISTS` });
  }

  // H4b — CREATE POLICY sin DROP POLICY previa (idempotencia PG<16)
  const policyRe = /create\s+policy\s+"([^"]+)"\s+on\s+(public\.[a-z0-9_]+)/gi;
  for (const m of body.matchAll(policyRe)) {
    const [, polName, target] = m;
    const dropRe = new RegExp(
      `drop\\s+policy\\s+if\\s+exists\\s+"${polName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+on\\s+${target.replace(/\./, "\\.")}`,
      "i",
    );
    if (!dropRe.test(body)) {
      out.push({
        file,
        check: "H4",
        detail: `CREATE POLICY "${polName}" on ${target} sin DROP POLICY IF EXISTS previa`,
      });
    }
  }

  // H5 — DROP TABLE sin IF EXISTS
  const dropTableRe = /drop\s+table\s+(?!if\s+exists)public\.([a-z0-9_]+)/gi;
  for (const m of body.matchAll(dropTableRe)) {
    out.push({ file, check: "H5", detail: `DROP TABLE public.${m[1]} sin IF EXISTS` });
  }

  // H6 — SECURITY DEFINER requiere REVOKE + GRANT EXECUTE apropiados
  out.push(...scanSecurityDefiner(file, body, auditPostBaseline));

  // H7 (P-10) — `ALTER TYPE ... RENAME VALUE` no reescribe los cuerpos de las
  // funciones: cualquier función creada antes con el literal viejo queda rota
  // en runtime (22P02). Exigimos recrear dependientes en la misma migración.
  const renameValueRe = /alter\s+type\s+[a-z0-9_."]+\s+rename\s+value/gi;
  if (renameValueRe.test(body) && !/create\s+(or\s+replace\s+)?function/i.test(body)) {
    out.push({
      file,
      check: "H7",
      detail:
        "ALTER TYPE ... RENAME VALUE sin recrear funciones dependientes en el mismo archivo",
    });
  }

  // H8 (FIX-F964) — backfills que usan funciones con guard multi-tenant.
  out.push(...scanBackfillTenantGuard(file, body));

  // H9 (auditoría 3 · M6) — prohibido parchear funciones por texto con
  // `replace(pg_get_functiondef(...))`. Ese patrón deja el cuerpo real de la
  // función dependiendo del estado previo de la BD, así que una base limpia y
  // producción divergen en silencio (causa raíz del hallazgo C1). Regla dura:
  // aplica también a legacy. Toda función se re-emite completa con
  // `CREATE OR REPLACE FUNCTION`.
  if (/replace\s*\(\s*pg_get_functiondef/i.test(body)) {
    out.push({
      file,
      check: "H9",
      detail:
        "parcheo textual de función con replace(pg_get_functiondef(...)); re-emitir CREATE OR REPLACE FUNCTION completo",
    });
  }

  return out;


  return out;
}



function main() {
  const all = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  const violations: Violation[] = [];
  const badNames: string[] = [];

  for (const f of all) {
    const match = FNAME_RE.exec(f);
    const rawTs = /^(\d{14})/.exec(f)?.[1];
    const isPostBaseline = !rawTs || rawTs >= BASELINE;
    if (!isPostBaseline) {
      // Legacy: sólo evaluamos H6 regla dura (GRANT EXECUTE ... TO PUBLIC).
      const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
      const legacy = scanFile(f, body, false).filter(
        (v) => v.check === "H6" || v.check === "H9",
      );
      violations.push(...legacy);
      continue;
    }
    if (!match) {
      badNames.push(f);
      continue;
    }
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    violations.push(...scanFile(f, body, true));
  }

  const total = badNames.length + violations.length;
  console.log(`\n${"=".repeat(64)}\nAudit migraciones (baseline ${BASELINE})\n${"=".repeat(64)}`);
  console.log(`Archivos revisados: ${all.filter((f) => (FNAME_RE.exec(f)?.[1] ?? "0") >= BASELINE).length} / ${all.length} totales`);

  if (badNames.length > 0) {
    console.log(`\n❌ H1 — nombre inválido (${badNames.length}):`);
    badNames.forEach((f) => console.log(`  • ${f}`));
  }

  if (violations.length > 0) {
    const byCheck = new Map<string, Violation[]>();
    for (const v of violations) {
      const arr = byCheck.get(v.check) ?? [];
      arr.push(v);
      byCheck.set(v.check, arr);
    }
    for (const [check, arr] of [...byCheck.entries()].sort()) {
      console.log(`\n❌ ${check} — ${arr.length} violación(es):`);
      arr.forEach((v) => console.log(`  • ${v.file}: ${v.detail}`));
    }
  }

  if (total === 0) {
    console.log("\n✅ Migraciones limpias (post-baseline).\n");
    process.exit(0);
  }
  console.log(`\nTotal: ${total} violación(es). Corregir antes de mergear.\n`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
