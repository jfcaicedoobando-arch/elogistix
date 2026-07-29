#!/usr/bin/env tsx
/**
 * scripts/e2e/seed-demo.ts — siembra idempotente de datos "demo" para una
 * organización E2E: 3 navieras, 2 agentes, 2 rutas, 3 tarifas vigentes,
 * 8 productos/servicios, 2 cuentas bancarias (MXN/USD) + 1 tipo de cambio
 * del día, 1 cliente y 1 proveedor.
 *
 * Los datos "puros" viven en `src/lib/e2e/seedDemoData.ts` (con su test
 * unitario); este script sólo los inserta vía `psql` usando UPSERT por
 * clave natural (ON CONFLICT), por lo que correrlo varias veces es seguro.
 *
 * Uso:
 *   bun run e2e:seed
 *
 * Requiere en el entorno (o `.env.e2e`):
 *   DATABASE_URL o SUPABASE_DB_URL   Cadena de conexión Postgres con permisos
 *                                    de escritura (mismo secreto que usa
 *                                    `audit:db-integrity`).
 *   E2E_ORG_ID                       UUID de la organización demo objetivo.
 *
 * No requiere `psql` en PATH más allá de lo que ya usa `bun run audit:db-integrity`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";

import {
  SEED_AGENTES,
  SEED_CLIENTE,
  SEED_CUENTAS_BANCARIAS,
  SEED_NAVIERAS,
  SEED_PRODUCTOS_SERVICIOS,
  SEED_PROVEEDOR,
  SEED_RUTAS,
  SEED_TARIFAS,
  SEED_TIPO_CAMBIO,
} from "../../src/lib/e2e/seedDemoData";

const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Falta variable de entorno: ${name}`);
    process.exit(1);
  }
  return v;
}

const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("❌ Falta DATABASE_URL o SUPABASE_DB_URL");
  process.exit(1);
}
const orgId = required("E2E_ORG_ID");

/** Escapa un literal para SQL (comillas simples). Sólo para strings de confianza (semilla propia). */
function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
function sqlNum(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

const statements: string[] = [];

statements.push("BEGIN;");

// 1) Navieras (catálogo global, clave natural: code)
for (const n of SEED_NAVIERAS) {
  statements.push(`
INSERT INTO public.navieras (code, name, activo)
VALUES (${sqlStr(n.code)}, ${sqlStr(n.name)}, true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, activo = true;`);
}

// 2) Agentes (clave natural: organization_id + nombre)
for (const a of SEED_AGENTES) {
  statements.push(`
INSERT INTO public.costeo_agentes (organization_id, nombre, pais, dias_credito, email, activo)
VALUES (${sqlStr(orgId)}, ${sqlStr(a.nombre)}, ${sqlStr(a.pais)}, ${sqlNum(a.diasCredito)}, ${sqlStr(a.email)}, true)
ON CONFLICT (organization_id, nombre) DO UPDATE
  SET pais = EXCLUDED.pais, dias_credito = EXCLUDED.dias_credito, email = EXCLUDED.email, activo = true;`);
}

// 3) Rutas (clave natural: organization_id + puerto_origen + puerto_destino, resueltos por code)
for (const r of SEED_RUTAS) {
  statements.push(`
INSERT INTO public.costeo_rutas (organization_id, puerto_origen_id, puerto_destino_id, activa)
SELECT ${sqlStr(orgId)}, po.id, pd.id, true
FROM public.puertos po, public.puertos pd
WHERE po.code = ${sqlStr(r.puertoOrigen.code)} AND pd.code = ${sqlStr(r.puertoDestino.code)}
ON CONFLICT (organization_id, puerto_origen_id, puerto_destino_id) DO UPDATE SET activa = true;`);
}

// 4) Tarifas vigentes (clave natural: organization_id + agente + naviera + ruta + tipo_contenedor + vigente_desde)
for (const t of SEED_TARIFAS) {
  statements.push(`
INSERT INTO public.costeo_tarifas (
  organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
  moneda, flete_base, vigente_desde, vigente_hasta, estado
)
SELECT ${sqlStr(orgId)}, ag.id, nv.id, rt.id, tc.id,
  ${sqlStr(t.moneda)}, ${sqlNum(t.fleteBase)},
  (CURRENT_DATE + ${sqlNum(t.diasVigenciaDesdeHoy)}), (CURRENT_DATE + ${sqlNum(
    t.diasVigenciaDesdeHoy + t.diasDuracionVigencia,
  )}), 'vigente'
FROM public.costeo_agentes ag, public.navieras nv, public.costeo_rutas rt,
     public.puertos po, public.puertos pd, public.tipos_contenedor tc
WHERE ag.organization_id = ${sqlStr(orgId)} AND ag.nombre = ${sqlStr(t.agenteNombre)}
  AND nv.code = ${sqlStr(t.navieraCode)}
  AND rt.organization_id = ${sqlStr(orgId)}
  AND rt.puerto_origen_id = po.id AND po.code = ${sqlStr(t.ruta.puertoOrigen.code)}
  AND rt.puerto_destino_id = pd.id AND pd.code = ${sqlStr(t.ruta.puertoDestino.code)}
  AND tc.code = ${sqlStr(t.tipoContenedorCode)}
ON CONFLICT (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, vigente_desde) DO UPDATE
  SET flete_base = EXCLUDED.flete_base, vigente_hasta = EXCLUDED.vigente_hasta, estado = 'vigente';`);
}

// 5) Productos/servicios (clave natural: organization_id + lower(patron))
for (const p of SEED_PRODUCTOS_SERVICIOS) {
  statements.push(`
INSERT INTO public.catalogo_claves_sat (
  organization_id, patron, clave_sat, clave_unidad_sat, nombre_unidad, tasa_iva_default, tipo_iva, activo
)
VALUES (${sqlStr(orgId)}, ${sqlStr(p.patron)}, ${sqlStr(p.claveSat)}, ${sqlStr(p.claveUnidadSat)}, ${sqlStr(
    p.nombreUnidad,
  )}, ${sqlNum(p.tasaIvaDefault)}, 'tasa', true)
ON CONFLICT (organization_id, lower(patron)) DO UPDATE
  SET clave_sat = EXCLUDED.clave_sat, clave_unidad_sat = EXCLUDED.clave_unidad_sat,
      nombre_unidad = EXCLUDED.nombre_unidad, tasa_iva_default = EXCLUDED.tasa_iva_default, activo = true;`);
}

// 6) Cuentas bancarias (sin índice único en DB → upsert manual por organization_id + alias)
for (const c of SEED_CUENTAS_BANCARIAS) {
  statements.push(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cuentas_bancarias
    WHERE organization_id = ${sqlStr(orgId)} AND alias = ${sqlStr(c.alias)}
  ) THEN
    UPDATE public.cuentas_bancarias
    SET banco = ${sqlStr(c.banco)}, numero_cuenta = ${sqlStr(c.numeroCuenta)}, clabe = ${sqlStr(c.clabe)},
        moneda = ${sqlStr(c.moneda)}, saldo_inicial = ${sqlNum(c.saldoInicial)}, activa = true, deleted_at = NULL
    WHERE organization_id = ${sqlStr(orgId)} AND alias = ${sqlStr(c.alias)};
  ELSE
    INSERT INTO public.cuentas_bancarias (organization_id, alias, banco, numero_cuenta, clabe, moneda, saldo_inicial, activa)
    VALUES (${sqlStr(orgId)}, ${sqlStr(c.alias)}, ${sqlStr(c.banco)}, ${sqlStr(c.numeroCuenta)}, ${sqlStr(c.clabe)}, ${sqlStr(
    c.moneda,
  )}, ${sqlNum(c.saldoInicial)}, true);
  END IF;
END $$;`);
}

// 7) Tipo de cambio del día (clave natural: fecha)
statements.push(`
INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, fuente, origen)
VALUES (CURRENT_DATE, ${sqlNum(SEED_TIPO_CAMBIO.usdMxn)}, ${sqlStr(SEED_TIPO_CAMBIO.fuente)}, ${sqlStr(
  SEED_TIPO_CAMBIO.origen,
)})
ON CONFLICT (fecha) DO UPDATE SET usd_mxn = EXCLUDED.usd_mxn, fuente = EXCLUDED.fuente, origen = EXCLUDED.origen;`);

// 8) Cliente (clave natural: organization_id + upper(rfc))
statements.push(`
INSERT INTO public.clientes (organization_id, nombre, rfc, contacto, email, telefono, direccion, ciudad, estado, cp, dias_credito)
VALUES (${sqlStr(orgId)}, ${sqlStr(SEED_CLIENTE.nombre)}, ${sqlStr(SEED_CLIENTE.rfc)}, ${sqlStr(
  SEED_CLIENTE.contacto,
)}, ${sqlStr(SEED_CLIENTE.email)}, ${sqlStr(SEED_CLIENTE.telefono)}, ${sqlStr(SEED_CLIENTE.direccion)}, ${sqlStr(
  SEED_CLIENTE.ciudad,
)}, ${sqlStr(SEED_CLIENTE.estado)}, ${sqlStr(SEED_CLIENTE.cp)}, ${sqlNum(SEED_CLIENTE.diasCredito)})
ON CONFLICT (organization_id, upper(btrim(rfc))) DO UPDATE
  SET nombre = EXCLUDED.nombre, contacto = EXCLUDED.contacto, email = EXCLUDED.email,
      telefono = EXCLUDED.telefono, direccion = EXCLUDED.direccion, ciudad = EXCLUDED.ciudad,
      estado = EXCLUDED.estado, cp = EXCLUDED.cp, dias_credito = EXCLUDED.dias_credito, deleted_at = NULL;`);

// 9) Proveedor (clave natural: organization_id + upper(rfc))
statements.push(`
INSERT INTO public.proveedores (organization_id, nombre, rfc, contacto, email, telefono, categoria, tipo, moneda_preferida, dias_credito)
VALUES (${sqlStr(orgId)}, ${sqlStr(SEED_PROVEEDOR.nombre)}, ${sqlStr(SEED_PROVEEDOR.rfc)}, ${sqlStr(
  SEED_PROVEEDOR.contacto,
)}, ${sqlStr(SEED_PROVEEDOR.email)}, ${sqlStr(SEED_PROVEEDOR.telefono)}, ${sqlStr(
  SEED_PROVEEDOR.categoria,
)}::categoria_proveedor, ${sqlStr(SEED_PROVEEDOR.tipo)}::tipo_proveedor, ${sqlStr(
  SEED_PROVEEDOR.monedaPreferida,
)}::moneda, ${sqlNum(SEED_PROVEEDOR.diasCredito)})
ON CONFLICT (organization_id, upper(btrim(rfc))) DO UPDATE
  SET nombre = EXCLUDED.nombre, contacto = EXCLUDED.contacto, email = EXCLUDED.email,
      telefono = EXCLUDED.telefono, categoria = EXCLUDED.categoria, tipo = EXCLUDED.tipo,
      moneda_preferida = EXCLUDED.moneda_preferida, dias_credito = EXCLUDED.dias_credito, deleted_at = NULL;`);

statements.push("COMMIT;");

const sql = statements.join("\n");
const tmpDir = mkdtempSync(join(tmpdir(), "e2e-seed-demo-"));
const sqlFile = join(tmpDir, "seed-demo.sql");
writeFileSync(sqlFile, sql, "utf8");

console.log(`→ Sembrando organización demo ${orgId} ...`);
try {
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", sqlFile], {
    stdio: "inherit",
  });
} catch (err) {
  console.error("❌ Falló la siembra:", err);
  process.exit(1);
}

console.log("✅ Semilla demo aplicada (idempotente).");
console.log(
  `   Navieras: ${SEED_NAVIERAS.length} · Agentes: ${SEED_AGENTES.length} · Rutas: ${SEED_RUTAS.length} · ` +
    `Tarifas: ${SEED_TARIFAS.length} · Productos/Servicios: ${SEED_PRODUCTOS_SERVICIOS.length} · ` +
    `Cuentas bancarias: ${SEED_CUENTAS_BANCARIAS.length} · Cliente: 1 · Proveedor: 1`,
);
