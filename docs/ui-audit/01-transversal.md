# Auditoría UI · Capa 1 — Transversal (inconsistencias globales)

> Escaneo `rg` sobre `src/**/*.tsx`, excluyendo `src/components/ui/**`,
> `src/generators/**`, `src/pdf/**`, `**/__tests__/**` y tests. Referencia:
> [`00-baseline.md`](./00-baseline.md).
> Auditado sobre `v13.219.4` a viewport 1920×1080.

## Resumen ejecutivo

| # | Categoría | Ocurrencias | Severidad | Ámbito |
|---|---|---|---|---|
| 1 | `max-w-7xl` en wrappers de página (portales) | **7** | **ALTA** | Portal cliente + Portal agente |
| 2 | `text-white` hardcoded (badges/iconos KPI) | 5 | Media | Dashboard + AlertasDemora + BrandLockup |
| 3 | `bg-white` hardcoded (logo wrappers) | 3 | Baja | BrandLockup + Landing |
| 4 | `shadow-sm` fuera de UI kit | **17** | Media | Varios |
| 5 | `shadow-md/lg/xl/2xl` fuera de UI kit | 11 | Media | Varios |
| 6 | `rounded-2xl` fuera de UI kit | **13** | Media | Cards y wrappers |
| 7 | `rounded-3xl` | 1 | Baja | 1 archivo |
| 8 | `max-w-6xl / 5xl / 4xl / 3xl` en modales/wrappers | **51** | Media | Formularios anchos |
| 9 | Off-system dentro de LogoPreview (marketing) | 9 | Baja | Aislado a `LogoPreview.tsx` (aceptado) |

**Distribución de spacing y gaps**: consistente. No hay `p-5/p-7/gap-5/gap-7`
detectados en volumen significativo. Los `p-2/p-3` son mayoritariamente
padding interno de sub-componentes (iconos, chips, filas de tabla), no de
página — comportamiento correcto.

---

## Hallazgo #1 — `max-w-7xl` en layouts de portales · **ALTA**

### Problema
Los layouts de los portales (cliente y agente) usan `max-w-7xl` (1280px). En
1920×1080 esto deja **~320px de banda vacía a cada lado** (33% del ancho).
Rompe la sensación de "misma app" respecto a la interna, que llega a 1536px.

### Archivos afectados (7 ocurrencias)

| Archivo | Línea | Uso |
|---|---|---|
| `src/features/portal-agente/components/AgenteLayout.tsx` | 40 | Header portal agente |
| `src/features/portal-agente/components/AgenteLayout.tsx` | 115 | Main portal agente |
| `src/features/portal-agente/components/AgenteLayout.tsx` | 120 | Footer portal agente |
| `src/features/portal/components/layout/PortalHeader.tsx` | 30 | Header portal cliente |
| `src/features/portal/components/layout/PortalBreadcrumbsBar.tsx` | 17 | Breadcrumbs portal cliente |
| `src/features/portal/components/PortalLayout.tsx` | 47 | Main portal cliente |
| `src/features/portal/components/PortalLayout.tsx` | 52 | Footer portal cliente |

### Fix propuesto

Reemplazar en **los 7 lugares**:

```diff
- max-w-7xl mx-auto px-3 sm:px-6 lg:px-8
+ max-w-screen-2xl mx-auto px-4 sm:px-6
```

Justificación: alinear con `PageContainer` de la app interna. Nota: el
padding lateral de portal usa `px-3 sm:px-6 lg:px-8` (3 breakpoints) mientras
que interno usa `p-4 sm:p-6` (2 breakpoints). Se propone unificar en el
interno para no complicar responsividad — el salto `lg:px-8` no aporta a
1920 y sí lo puede recortar de forma inesperada en 1440.

---

## Hallazgo #2 — `text-white` hardcoded en iconos/badges · Media

Rompe la regla de "nunca hardcodear color". Aunque el color queda "blanco"
por diseño (icono sobre círculo de color intenso), el token correcto es
`text-primary-foreground` (que resuelve a blanco en light y stroke luminoso
en dark).

| Archivo | Línea | Contexto |
|---|---|---|
| `src/features/dashboard/components/statusCards/TimelineEstadosCard.tsx` | 43 | Icono de estado sobre círculo de color |
| `src/features/dashboard/components/statusCards/ArribosCard.tsx` | 108 | Icono CalendarDays sobre círculo |
| `src/features/dashboard/components/AlertasDemoraCard.tsx` | 36 | Número dentro del badge circular |

### Fix propuesto

```diff
- text-white
+ text-primary-foreground
```

En los 3 archivos, sobre el mismo elemento. Los `bg-white` de `BrandLockup`
y landing son **aceptables** porque el logo requiere un fondo blanco sólido
por identidad visual (paleta fija en `.landing-scope`).

---

## Hallazgo #3 — Sombras off-system · Media

**17 ocurrencias de `shadow-sm`, 7 de `shadow-md`, 2 `shadow-lg`, 1 `shadow-xl`, 1 `shadow-2xl`** fuera del UI kit. La regla es usar `shadow-card | shadow-raised | shadow-overlay`.

**Consecuencia visual**: cards en distintos módulos tienen distinta elevación
percibida, provocando esa sensación de "parches".

### Enfoque de remediación

1. `shadow-sm` en cards de dashboard/KPI → `shadow-card`.
2. `shadow-md` en botones flotantes/tooltips custom → `shadow-raised`.
3. `shadow-lg/xl/2xl` en overlays → `shadow-overlay` (o si es un Dialog, ya
   viene aplicado por el componente shadcn, y hay que **quitar** la clase
   redundante).

Detalle archivo-por-archivo se entrega en Capa 2 (componentes) para poder
proponer patch quirúrgico. Aquí solo se cuantifica.

---

## Hallazgo #4 — `rounded-2xl` fuera de UI kit · Media

13 ocurrencias. El sistema tiene tres radios: `rounded-sm (6) · rounded-lg (8) · rounded-xl (12)`. `rounded-2xl` (16px) genera cards con esquinas más redondeadas
que el resto y se ve inconsistente al lado de Cards shadcn.

### Fix

Migrar todas a `rounded-xl` salvo casos de **avatar/pill** donde debería ser
`rounded-full`. Detalle se produce en Capa 2 al revisar cada componente.

---

## Hallazgo #5 — `max-w-6xl / 5xl / 4xl / 3xl` en modales · Media

51 ocurrencias distribuidas. Estas anchuras aparecen mayoritariamente dentro
de **DialogContent** o **wrappers de formulario**. Muchas son legítimas
(un modal de captura no necesita 1536px). Se auditan uno-a-uno en Capa 2 y
solo se marcan como violación los casos donde:

- El wrapper aparece a **nivel de página** (no dentro de un dialog).
- El modal tiene tabla / grid de columnas y queda apretado por el max-width.

Los formularios de captura simples (1 columna) están **correctos** con
`max-w-3xl/4xl`.

---

## Hallazgo #6 — `LogoPreview` fuera de tokens (aceptado)

`src/features/marketing/routes/LogoPreview.tsx` usa `bg-[#0B1B3A]`,
`bg-[#2563EB]`, `text-slate-500`, `text-slate-200`, etc. **Aceptado**: es la
página interna para previsualizar el logo sobre distintos fondos de marca —
requiere valores literales por definición. **Sin acción**.

---

## Top-10 archivos ofensores (por total de infracciones agregadas)

| # | Archivo | Infracciones |
|---|---|---|
| 1 | `src/features/portal/components/PortalLayout.tsx` | 3 (`max-w-7xl`) |
| 2 | `src/features/portal-agente/components/AgenteLayout.tsx` | 3 (`max-w-7xl`) |
| 3 | `src/features/marketing/routes/LogoPreview.tsx` | 9 (aceptado) |
| 4 | `src/features/portal/components/layout/PortalHeader.tsx` | 1 (`max-w-7xl`) |
| 5 | `src/features/portal/components/layout/PortalBreadcrumbsBar.tsx` | 1 (`max-w-7xl`) |
| 6 | `src/features/dashboard/components/statusCards/TimelineEstadosCard.tsx` | 1 (`text-white`) |
| 7 | `src/features/dashboard/components/statusCards/ArribosCard.tsx` | 1 (`text-white`) |
| 8 | `src/features/dashboard/components/AlertasDemoraCard.tsx` | 1 (`text-white`) |
| 9 + | Distribuido: 17 archivos con `shadow-sm`, 13 con `rounded-2xl` | ver Capa 2 |

---

## Evidencia visual (1920×1080)

Screenshots en [`./screenshots/`](./screenshots/):

- `inicio.png` — Dashboard. Layout llega a `max-w-screen-2xl`, KPIs coherentes.
- `embarques.png` — Lista. Tabla llena bien el ancho. Toolbar y filtros ok.
- `cotizaciones.png` — Lista.
- `cxp.png` (compras/facturas) — CxP principal.
- `por-capturar.png` — Bandeja "Por capturar".
- `facturacion.png` — Cockpit fiscal. **Observación visual manual**:
  la fila de KPIs usa 6 columnas con "microcategorías" en gris arriba
  (`PREPARAR`, `COBRAR`, `HISTÓRICO`) que **no aparecen en ningún otro
  módulo**. Es un patrón exclusivo de esta pantalla → candidato "parche".
  Se detalla en Capa 3 tranche B.
- `clientes.png`, `proveedores.png` — Catálogos.

---

## Próximos pasos

1. **Aprobación de este reporte** → aplicar **Lote 1** con:
   - Fix H#1: `max-w-7xl` → `max-w-screen-2xl` en los 7 lugares de portales.
   - Fix H#2: `text-white` → `text-primary-foreground` en los 3 iconos de dashboard.
   - Bump `APP_VERSION` a `13.220.0` y entrada en `CHANGELOG.md`.
2. Continuar con **Capa 2 — Componentes** (sombras, radios, tabs, badges custom).
3. Después, **Capa 3 tranche A** (Operación diaria: inicio, embarques, cotizaciones).

---

_Última actualización: v13.219.4_
