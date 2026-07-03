#!/usr/bin/env node
/**
 * Verificación de consistencia visual (design language).
 *
 * Recorre las rutas principales autenticadas y guarda una captura por ruta
 * para revisar side-by-side que headers, filtros, badges y KPIs estén
 * homologados tras las Olas 1–7.
 *
 * Uso:
 *   node scripts/visual-audit/capture.mjs [--base=http://localhost:8080] [--out=./visual-snapshots]
 *
 * Requiere: `playwright` con Chromium. En sandbox de Lovable ya viene instalado
 * (PLAYWRIGHT_BROWSERS_PATH pre-seteado). Fuera del sandbox correr:
 *   bunx playwright install chromium
 *
 * Credenciales: usa AUDIT_EMAIL / AUDIT_PASSWORD (ver mem://reference/audit-login).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const BASE = argv.base ?? process.env.AUDIT_BASE_URL ?? "http://localhost:8080";
const OUT = path.resolve(argv.out ?? "./visual-snapshots");
const EMAIL = process.env.AUDIT_EMAIL ?? "hector@lopezbenavides.com";
const PASSWORD = process.env.AUDIT_PASSWORD ?? "1234567890";

/**
 * Rutas críticas por dominio funcional. Un slug estable por ruta se usa como
 * nombre de archivo para poder comparar entre corridas (baseline vs actual).
 */
const ROUTES = [
  // Núcleo operativo
  { slug: "01-inicio", path: "/inicio" },
  { slug: "02-operaciones", path: "/operaciones" },
  { slug: "03-embarques", path: "/embarques" },
  { slug: "04-cotizaciones", path: "/cotizaciones" },
  { slug: "05-proformas", path: "/proformas" },
  { slug: "06-facturacion", path: "/facturacion" },

  // Financiero
  { slug: "10-compras", path: "/compras" },
  { slug: "11-cxp", path: "/cxp" },
  { slug: "12-cartera", path: "/cartera" },
  { slug: "13-tesoreria", path: "/tesoreria" },
  { slug: "14-profit-dashboard", path: "/profit/dashboard" },
  { slug: "15-profit-proyeccion", path: "/profit/proyeccion" },

  // Catálogos / CRM
  { slug: "20-clientes", path: "/clientes" },
  { slug: "21-proveedores", path: "/proveedores" },

  // Costeo
  { slug: "30-costeo-tarifas", path: "/costeo/tarifas" },
  { slug: "31-costeo-rutas", path: "/costeo/rutas" },
  { slug: "32-costeo-navieras", path: "/costeo/navieras" },
  { slug: "33-costeo-agentes", path: "/costeo/agentes" },

  // Reportes
  { slug: "40-reportes-rentabilidad", path: "/reportes/rentabilidad" },
  { slug: "41-reportes-cierre", path: "/reportes/cierre-mensual" },

  // Admin plataforma
  { slug: "50-admin", path: "/admin" },
  { slug: "51-admin-organizaciones", path: "/admin/organizaciones" },
  { slug: "52-admin-auditoria", path: "/admin/auditoria" },
];

const VIEWPORT = { width: 1440, height: 900 };

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 }),
    page.getByRole("button", { name: /iniciar sesión/i }).click(),
  ]);
}

async function capture(page, route) {
  const url = `${BASE}${route.path}`;
  const errors = [];
  const onErr = (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("console", onErr);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
  } catch (e) {
    // Continuar aunque no llegue a networkidle: capturamos lo que haya.
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600); // deja asentar animaciones y skeletons
  const file = path.join(OUT, `${route.slug}.png`);
  await page.screenshot({ path: file, fullPage: false });
  page.off("console", onErr);
  return { ...route, file, errors };
}

async function main() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "es-MX" });
  const page = await ctx.newPage();

  const results = [];
  try {
    await login(page);
    for (const r of ROUTES) {
      console.log(`→ ${r.path}`);
      results.push(await capture(page, r));
    }
  } finally {
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    viewport: VIEWPORT,
    routes: results.map((r) => ({ slug: r.slug, path: r.path, file: r.file, consoleErrors: r.errors.length })),
  };
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Reporte de consistencia visual",
    "",
    `Generado: ${report.generatedAt}  ·  Base: ${BASE}  ·  Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`,
    "",
    "| # | Ruta | Errores consola | Captura |",
    "|---|------|-----------------|---------|",
    ...results.map((r, i) => `| ${i + 1} | \`${r.path}\` | ${r.errors.length} | \`${path.basename(r.file)}\` |`),
  ].join("\n");
  writeFileSync(path.join(OUT, "REPORT.md"), md);

  console.log(`\n✅ ${results.length} capturas en ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
