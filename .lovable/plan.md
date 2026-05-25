# Auditoría fresca — Bloatware y eficiencia (v11.46.0)

Corrí build + knip + análisis de bundle. La app está sana arquitectónicamente, pero hay **bloat real** muy concreto, mayormente en el bundle y en assets.

## Hallazgos principales

### A. Bundle JS (lo más impactante)

| Chunk | Tamaño | Gzip | Diagnóstico |
|---|---|---|---|
| `pdf-vendor` (@react-pdf/renderer) | **1,441 KB** | 475 KB | Pesa más que todo el resto junto. Hoy se carga al entrar a cualquier página que importe `descargarPdf` (Facturación, Cotizaciones, Proformas). |
| `sentry-vendor` | 475 KB | 151 KB | Carga eager en `main.tsx`. Muy grande para un proyecto demo. |
| `index` (main) | 405 KB | 112 KB | Razonable, pero arrastra cosas que podrían ser lazy. |
| `charts-vendor` (recharts) | 348 KB | 92 KB | Se carga aunque el usuario nunca abra Dashboard/Operaciones/Auditoría. |
| `react-vendor` | 257 KB | 82 KB | Normal, no se toca. |
| `radix-vendor` | 135 KB | 40 KB | Normal. |
| `phone-vendor` (libphonenumber-js) | 118 KB | 29 KB | Solo se usa en `lib/formatters/phone.ts`. Variante `/min` pesa ~75% menos. |

### B. Código muerto (knip)

- **9 archivos no usados**: `CrmNotificacionesBell`, `DialogDuplicarEmbarque`, `EmbarqueRowActions`, `useDuplicarCotizacion`, `lib/financial/index.ts`, `lib/mappers/index.ts`, `lib/parsers/index.ts`, `pages/crm/Forecast.tsx`, `pages/crm/Reportes.tsx`.
- **14 exports no usados** en hooks de CRM/embarques/cotizaciones/servicios.
- **3 tipos exportados no usados**.
- **2 deps no usadas**: `@dnd-kit/sortable`, `@dnd-kit/utilities` (solo `@dnd-kit/core` se usa).
- **1 dep no listada**: `@react-pdf/types` (usado pero no declarado).

### C. Assets (public/ + src/assets)

- `librecarga-logo.png` **duplicado** en `public/` y `src/assets/` — mismo MD5, 157 KB cada uno (314 KB total).
- `favicon.png` 134 KB — debería ser <10 KB.
- `public/changelog.json` 280 KB — se sirve completo; podría paginar o generar al build.
- Ya existe `librecarga-logo.svg` (668 B) — usar SVG donde se pueda.

### D. Lo que **NO** es bloat

- `src/components/ui/sidebar.tsx` (637 LOC) es shadcn standard, no tocar.
- 332 componentes / 199 hooks / 109 servicios suena mucho, pero la mayoría son <150 LOC y bien factorizados. La auditoría arquitectónica anterior ya cerró Track B.
- `radix-vendor` y `react-vendor` están en el rango esperado.

---

## Plan de cambios (v11.46.0)

### Sub-loop 1 — Lazy del PDF (mayor ROI, ~475 KB gzip diferidos)

Convertir `descargarPdf` y `PdfPreview` a import dinámico:

```ts
// services/pdf/lazy.ts (nuevo)
export const descargarPdf = async (...args) => {
  const mod = await import("@/pdf/render/descargarPdf");
  return mod.descargarPdf(...args);
};
```

Migrar 4–6 call sites (`FacturaDownloadButton`, `useDescargarProformaPdf`, etc.). El chunk `pdf-vendor` deja de bajarse al cargar páginas de Facturación/Cotizaciones hasta que el usuario haga click en "Descargar".

### Sub-loop 2 — Recortar libs pesadas

- **libphonenumber-js** → cambiar imports a `libphonenumber-js/min` (mismo API, sin metadata de países raros). Ahorro ~90 KB.
- **recharts**: ya está en su propio vendor chunk, pero las 7 páginas que lo usan no son críticas. Hacer `React.lazy` de `OperacionesTendenciaChart`, `AuditoriaTendenciaChart`, `HealthTimelineChart` (los demás ya están en páginas lazy). Ahorro percibido en first paint.
- **Sentry**: dejarlo cargado (es importante), pero pasarlo a `replay: { sessionSampleRate: 0 }` si no está ya, para evitar bajar el replay bundle. Verificar `lib/sentry.ts`.

### Sub-loop 3 — Eliminar dead code

- Borrar los 9 archivos no usados.
- Borrar los 14 exports y 3 tipos no usados (o convertir a internal).
- `bun remove @dnd-kit/sortable @dnd-kit/utilities`.
- `bun add -D @react-pdf/types` (declarar la dep faltante).

### Sub-loop 4 — Assets

- Borrar `src/assets/librecarga-logo.png`, migrar imports al SVG (`/librecarga-logo.svg`) o al de `public/`.
- Re-generar `favicon.png` <10 KB (sólo 32×32 / 64×64).
- Verificar si `changelog.json` se puede generar bajo demanda o paginar (no urgente; postergar si requiere refactor del script).

### Sub-loop 5 — Versionado + verificación

- `APP_VERSION` → `11.46.0`, `CHANGELOG.md`, `src/pages/Changelog.tsx`.
- `bun run ci:local` (lint + knip + tests + build) y comparar tamaños antes/después.

---

## Resultado esperado

| Métrica | Antes | Después (estimado) |
|---|---|---|
| First load (gzip, sin entrar a PDF) | ~600 KB | **~150 KB** |
| `pdf-vendor` (sólo bajo demanda) | eager | lazy |
| Archivos en `src/` | 946 | ~937 |
| Deps en `package.json` | 60 | 58 |
| Assets duplicados | 2× logo | 0 |

## Fuera de alcance

- Reemplazar `recharts` por algo más liviano (sería un refactor mayor).
- Reemplazar `@react-pdf/renderer` por otro generador (mucho riesgo, todos los PDFs ya funcionan).
- P1.5 / P1.6 / P1.7 del audit anterior (siguen pendientes pero son arquitectura, no bloat).

¿Apruebas el plan?
