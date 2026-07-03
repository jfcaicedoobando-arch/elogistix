# Visual audit · design language

Recorrido automatizado para verificar que todas las rutas principales de la app
comparten el mismo design language después de las Olas 1–7 (PageContainer,
PageHeader, StatusBadge, FormDialogShell, KpiCard, etc.).

## Correr localmente

```bash
# 1. Levanta el dev server en otra terminal
bun run dev

# 2. Corre el auditor visual
node scripts/visual-audit/capture.mjs --base=http://localhost:8080 --out=./visual-snapshots
```

## Correr en el sandbox de Lovable

El dev server ya está corriendo en `http://localhost:8080` y Playwright/Chromium
vienen preinstalados. Basta con:

```bash
AUDIT_EMAIL=hector@lopezbenavides.com \
AUDIT_PASSWORD=1234567890 \
node scripts/visual-audit/capture.mjs --out=/tmp/visual-snapshots
```

## Variables

| Variable | Default | Descripción |
|---|---|---|
| `--base` / `AUDIT_BASE_URL` | `http://localhost:8080` | URL del preview |
| `--out` | `./visual-snapshots` | Carpeta de salida |
| `AUDIT_EMAIL` | `hector@lopezbenavides.com` | Usuario de pruebas (ver `mem://reference/audit-login`) |
| `AUDIT_PASSWORD` | `1234567890` | Password del usuario de pruebas |

## Qué produce

- `NN-slug.png` — captura 1440×900 por ruta.
- `report.json` — metadatos + conteo de errores de consola por ruta.
- `REPORT.md` — resumen legible en Markdown.

## Cómo se usa el reporte

1. Abre las capturas lado a lado y verifica:
   - **Header** con `PageHeader` (misma altura, misma tipografía).
   - **Filtros** con `UnifiedFiltersBar` (mismo alto, mismos radios).
   - **Badges** de estado consistentes (usando `StatusBadge`).
   - **KPI cards** con la misma sombra/borde (`KpiCard`).
   - Sin `text-[10px]`, `emerald-*` ni `amber-*` sueltos (usar tokens).
2. Si alguna ruta rompe el patrón, abre un hallazgo en `.lovable/plan.md`.

## Baseline

Guarda una carpeta de baseline (`./visual-snapshots-baseline/`) cuando el
design language esté 100% homologado. En corridas posteriores, un `diff` entre
carpetas te dice qué rutas regresionaron visualmente.
