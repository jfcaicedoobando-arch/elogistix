# Auditoría UI/UX Global · 1920×1080

## Objetivo
Lograr cohesión visual total: eliminar "parches", overflows en Full HD y desalineaciones entre módulos. Entregable = reportes en markdown con hallazgos priorizados y snippets listos, aplicados por lotes bajo tu aprobación.

## Metodología

Auditaré en **capas** (no ruta-por-ruta secuencial ciego), porque el 80% de los problemas de "sentirse parche" nacen de inconsistencias transversales. Después bajo a rutas específicas donde el patrón se rompe.

### Capa 0 — Base del sistema (1 turno, solo lectura)
Inventario de la fuente de verdad para poder marcar como "violación" todo lo demás:
- `src/index.css` + `tailwind.config.ts` → tokens de color, sombras, radios, tipografía.
- Componentes base shadcn en `src/components/ui/*` → variantes canónicas de button, card, dialog, input, table, badge.
- Layout raíz: `Layout.tsx`, `AppSidebar.tsx`, header, breadcrumbs, contenedor principal (¿`max-w-*`? ¿`container`? ¿ancho fluido?).
- Grid de página estándar: padding lateral, gap vertical entre secciones, ancho de contenido.

Salida: **`docs/ui-audit/00-baseline.md`** — tabla de tokens, variantes canónicas, y las reglas contra las que auditaré todo lo demás.

### Capa 1 — Transversal: patrones repetidos (1 turno, solo lectura)
Busca con `rg` en todo `src/`:
- **Colores hardcodeados**: `text-white`, `bg-black`, `bg-[#…]`, `text-gray-*`, `text-slate-*` fuera de tokens.
- **Tipografía dispareja**: mezcla de `text-sm/text-base` para labels, `text-2xl/text-3xl` para títulos de página, `font-bold` vs `font-semibold` en headers.
- **Spacing**: `p-3` vs `p-4` vs `p-6` en cards del mismo nivel; `gap-2/gap-3/gap-4` en toolbars; padding lateral de página distinto por ruta.
- **Radios y sombras**: `rounded-md/lg/xl` mezclados; `shadow-sm/md` vs tokens `shadow-card/raised`.
- **Anchos fijos** que rompen a 1920×1080: `max-w-7xl` (1280px → deja bandas laterales enormes en Full HD), containers `w-[…]px`, tablas sin `w-full`.

Salida: **`docs/ui-audit/01-transversal.md`** con conteo por infracción y top-10 archivos ofensores.

### Capa 2 — Componentes del UI kit (1 turno)
Compara instancias reales vs canon para: **Button, Card, Dialog/Modal, Input/Form, Table, Badge, Tabs, Empty state, Toolbar de filtros**. Marca "roturas" (usos que no usan la variante shadcn).

Salida: **`docs/ui-audit/02-componentes.md`**.

### Capa 3 — Rutas por tranches (3–5 turnos)
Recorridos con Playwright a **viewport 1920×1080** capturando screenshots. Agrupo por dominio para no repetir hallazgos:

```text
Tranche A · Operación diaria
  /inicio · /embarques · /embarques/:id · /cotizaciones · /cotizaciones/:id
Tranche B · Financiero
  /cxp · /cxp/por-capturar · /facturacion · /facturacion/:id · /tesoreria
Tranche C · Catálogos y admin
  /clientes · /proveedores · /admin/* · /configuracion · /auditoria
Tranche D · Portales
  /portal/cliente · /portal/agente
```

Para cada tranche: screenshot + reporte con hallazgos numerados (severidad, ruta, componente, snippet corregido).

### Capa 4 — Aplicación de fixes por lotes
Después de tu OK sobre cada reporte, aplico fixes en un solo commit lógico:
- **Lote 1** — tokens y utilidades globales (index.css, tailwind.config.ts, variantes UI).
- **Lote 2** — normalización de spacing/tipografía a nivel Layout y páginas.
- **Lote 3+** — arreglos específicos por ruta.

Cada lote: bump `APP_VERSION`, entrada en `CHANGELOG.md`, tests si aplica.

## Salidas concretas
- Carpeta `docs/ui-audit/` con reportes markdown numerados.
- Screenshots en `docs/ui-audit/screenshots/` referenciados desde los reportes.
- Fixes agrupados por lote, cada uno con su changelog entry.

## Detalles técnicos
- Playwright a `viewport={width:1920,height:1080}` con la sesión inyectada (`LOVABLE_BROWSER_AUTH_STATUS=injected`) para poder entrar a rutas autenticadas.
- Uso `code--exec` con `rg` para conteos rápidos en Capa 1–2.
- Uso subagentes (`acp_subagent--explore`) en paralelo para acelerar Capa 3 cuando la tranche toca ≥4 rutas.
- No aplico ningún cambio hasta que apruebes el reporte de la capa correspondiente.

## Punto de partida propuesto
Arrancar por **Capa 0 + Capa 1** en el próximo turno (solo lectura, sin cambios), entregando `00-baseline.md` y `01-transversal.md` con el top de infracciones globales. Con eso ya tendrás visibilidad de cuánto "parche" real hay antes de bajar a rutas.