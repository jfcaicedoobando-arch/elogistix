#!/usr/bin/env python3
"""Verificación de consistencia visual (design language).

Recorre rutas principales autenticadas y guarda una captura por ruta para
revisar side-by-side que headers, filtros, badges y KPIs sigan homologados
tras las Olas 1–7.

Uso:
    python scripts/visual-audit/capture.py [--base http://localhost:8080] [--out ./visual-snapshots]

Credenciales por defecto: mem://reference/audit-login (override con
AUDIT_EMAIL / AUDIT_PASSWORD).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright

ROUTES = [
    # Núcleo operativo
    ("01-inicio", "/inicio"),
    ("02-operaciones", "/operaciones"),
    ("03-embarques", "/embarques"),
    ("04-cotizaciones", "/cotizaciones"),
    ("05-proformas", "/proformas"),
    ("06-facturacion", "/facturacion"),
    # Financiero
    ("10-compras", "/compras"),
    ("11-cxp", "/cxp"),
    ("12-cartera", "/cartera"),
    ("13-tesoreria", "/tesoreria"),
    ("14-profit-dashboard", "/profit/dashboard"),
    ("15-profit-proyeccion", "/profit/proyeccion"),
    # Catálogos / CRM
    ("20-clientes", "/clientes"),
    ("21-proveedores", "/proveedores"),
    # Costeo
    ("30-costeo-tarifas", "/costeo/tarifas"),
    ("31-costeo-rutas", "/costeo/rutas"),
    ("32-costeo-navieras", "/costeo/navieras"),
    ("33-costeo-agentes", "/costeo/agentes"),
    # Reportes
    ("40-reportes-rentabilidad", "/reportes/rentabilidad"),
    ("41-reportes-cierre", "/reportes/cierre-mensual"),
    # Admin plataforma
    ("50-admin", "/admin"),
    ("51-admin-organizaciones", "/admin/organizaciones"),
    ("52-admin-auditoria", "/admin/auditoria"),
]

VIEWPORT = {"width": 1440, "height": 900}


async def login(page, base: str, email: str, password: str) -> None:
    await page.goto(f"{base}/login", wait_until="domcontentloaded")
    await page.locator("#email").fill(email)
    await page.locator("#password").fill(password)
    await page.get_by_role("button", name="Iniciar sesión").click()
    await page.wait_for_url(lambda url: "/login" not in url, timeout=25_000)


async def capture(page, base: str, slug: str, path: str, out_dir: Path) -> dict:
    errors: list[str] = []

    def on_console(msg):
        if msg.type == "error":
            errors.append(msg.text[:200])

    page.on("console", on_console)
    try:
        try:
            await page.goto(f"{base}{path}", wait_until="networkidle", timeout=20_000)
        except Exception:
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(700)
        file_path = out_dir / f"{slug}.png"
        await page.screenshot(path=str(file_path))
        return {"slug": slug, "path": path, "file": file_path.name, "errors": len(errors), "errorSamples": errors[:3]}
    finally:
        page.remove_listener("console", on_console)


async def run(base: str, out: Path, email: str, password: str) -> None:
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, locale="es-MX")
        page = await ctx.new_page()
        try:
            await login(page, base, email, password)
            results = []
            for slug, path in ROUTES:
                print(f"→ {path}")
                results.append(await capture(page, base, slug, path, out))
        finally:
            await browser.close()

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "base": base,
        "viewport": VIEWPORT,
        "routes": results,
    }
    (out / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))

    lines = [
        "# Reporte de consistencia visual",
        "",
        f"Generado: {report['generatedAt']}  ·  Base: {base}  ·  Viewport: {VIEWPORT['width']}×{VIEWPORT['height']}",
        "",
        "| # | Ruta | Errores consola | Captura |",
        "|---|------|-----------------|---------|",
    ]
    for i, r in enumerate(results, 1):
        lines.append(f"| {i} | `{r['path']}` | {r['errors']} | `{r['file']}` |")
    (out / "REPORT.md").write_text("\n".join(lines))
    print(f"\n✅ {len(results)} capturas en {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("AUDIT_BASE_URL", "http://localhost:8080"))
    ap.add_argument("--out", default="./visual-snapshots")
    args = ap.parse_args()

    email = os.environ.get("AUDIT_EMAIL", "hector@lopezbenavides.com")
    password = os.environ.get("AUDIT_PASSWORD", "1234567890")

    asyncio.run(run(args.base, Path(args.out).resolve(), email, password))


if __name__ == "__main__":
    main()
