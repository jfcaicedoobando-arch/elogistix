# Auditoría UI · Capa 2 — Componentes del UI kit

> Inventario **uno-a-uno** de sombras, radios, tabs custom y micro-componentes
> que rompen el sistema de diseño. Referencia: [`00-baseline.md`](./00-baseline.md).
> Auditado sobre `v13.220.0` (post-Lote 1).

## Reglas contra las que se audita (recordatorio)

- Sombras válidas fuera de `src/components/ui/`: `shadow-card | shadow-raised | shadow-overlay`.
- Radios válidos fuera de `src/components/ui/`: `rounded-sm | rounded-lg | rounded-xl | rounded-full`.
- Tabs: usar `Tabs / TabsList / TabsTrigger` de `@/components/ui/tabs`.
- **Alcance excluido** (paleta fija por identidad de marca / editorial):
  - `src/features/marketing/**` (landing pública, guías, LogoPreview).
  - `src/components/layout/BrandLockup.tsx` (logo wrapper).

---

## Sección A · Inventario de sombras (fuera de UI kit)

**Total:** 27 ocurrencias · **En scope de fix:** 15 · **Aceptadas (marketing/logo):** 12.

### A.1 · `hover:shadow-*` en cards interactivas — 8 casos · **HIGH**

Elevación en hover no consistente entre módulos: unos usan `hover:shadow-sm`,
otros `hover:shadow-md`. Debería ser `hover:shadow-raised` en todos.

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A1.1 | `src/features/portal/routes/PortalFacturas.tsx` | 89 | `hover:shadow-sm hover:border-accent/40` | `hover:shadow-raised hover:border-accent/40` |
| A1.2 | `src/features/portal/routes/PortalCotizaciones.tsx` | 92 | `hover:shadow-sm hover:border-accent/30` | `hover:shadow-raised hover:border-accent/30` |
| A1.3 | `src/features/portal/components/EmbarqueCard.tsx` | 64 | `hover:shadow-md hover:scale-[1.005]` | `hover:shadow-raised hover:scale-[1.005]` |
| A1.4 | `src/features/portal/components/dashboard/PortalKpiGrid.tsx` | 33 | `hover:shadow-md transition-all hover:border-accent/30` | `hover:shadow-raised transition-all hover:border-accent/30` |
| A1.5 | `src/features/dashboard/finance/components/KpiTile.tsx` | 35 | `transition-shadow hover:shadow-md h-full` | `transition-shadow hover:shadow-raised h-full` |
| A1.6 | `src/components/shared/KpiCard.tsx` | 57 | `onClick && "cursor-pointer hover:shadow-md"` | `onClick && "cursor-pointer hover:shadow-raised"` |
| A1.7 | `src/features/admin/routes/AdminDashboard.tsx` | 41 | `hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-primary/40` | `hover:shadow-raised group-hover:-translate-y-0.5 group-hover:border-primary/40` |
| A1.8 | `src/features/operaciones/components/OperadorCard.tsx` | 26 | `hover:shadow-md transition-shadow` | `hover:shadow-raised transition-shadow` |

### A.2 · `shadow-sm` en headers sticky de portales — 2 casos · Media

Ambos ya sufrían el problema del Lote 1 (max-w-7xl). Ahora el header sticky
usa `shadow-sm` cuando el token del sistema para elevación de barra sobre
contenido es `shadow-card`.

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A2.1 | `src/features/portal/components/layout/PortalHeader.tsx` | 29 | `border-b bg-card sticky top-0 z-50 shadow-sm` | `border-b bg-card sticky top-0 z-50 shadow-card` |
| A2.2 | `src/features/portal-agente/components/AgenteLayout.tsx` | 39 | `border-b bg-card sticky top-0 z-50 shadow-sm` | `border-b bg-card sticky top-0 z-50 shadow-card` |

### A.3 · `shadow-sm` en botones del footer de dialog — 2 casos · Baja

El botón shadcn `default` ya trae `shadow` propio; añadir `shadow-sm` a un
`<Button>` es redundante y visualmente inconsistente con los demás submits
del proyecto.

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A3.1 | `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx` | 60 | `<Button ... className="shadow-sm">` | **quitar** `className="shadow-sm"` |
| A3.2 | `src/features/cxp/components/DialogEditarFacturaProveedor.tsx` | 138 | `<Button ... className="shadow-sm">` | **quitar** `className="shadow-sm"` |

### A.4 · `shadow-sm` en badges y banners — 2 casos · Baja

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A4.1 | `src/features/costeo/components/TarifaResultCardParts.tsx` | 89 | `<Badge className="... shadow-sm">` | **quitar** `shadow-sm` (Badge no debe elevarse) |
| A4.2 | `src/features/marketing/components/DemoModeBanner.tsx` | 15 | `... bg-accent ... shadow-sm sm:text-sm` | `... bg-accent ... shadow-card sm:text-sm` (banner sticky del top, se justifica elevación) |

### A.5 · `shadow-lg` interactivo / sticky — 2 casos · Media

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A5.1 | `src/features/dashboard/components/statusCards/TimelineEstadosCard.tsx` | 38 | `hover:scale-110 hover:shadow-lg cursor-pointer` | `hover:scale-110 hover:shadow-raised cursor-pointer` |
| A5.2 | `src/features/crm/components/LeadsBulkBar.tsx` | 67 | `sticky top-0 z-10 bg-primary text-primary-foreground rounded-md shadow-lg p-3 ...` | `sticky top-0 z-10 bg-primary text-primary-foreground rounded-md shadow-raised p-3 ...` (**además** cambiar `rounded-md` → `rounded-lg` para alinear con radius base) |

### A.6 · `shadow-xl` en tooltip flotante del sidebar — 1 caso · Media

El tooltip que aparece cuando el sidebar está colapsado. Es una superficie
flotante (overlay), no un card, así que el token correcto es `shadow-overlay`.

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A6.1 | `src/components/layout/SidebarGroupBlock.tsx` | 68 | `bg-sidebar text-sidebar-foreground border-sidebar-border shadow-xl font-medium` | `bg-sidebar text-sidebar-foreground border-sidebar-border shadow-overlay font-medium` |

### A.7 · `shadow-md` en empty state — 1 caso · Baja

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| A7.1 | `src/features/embarques/components/EmbarquesEmptyState.tsx` | 12 | `<Card className="shadow-md">` | `<Card>` (el Card shadcn ya trae elevación adecuada; el empty state no necesita destacarse) |

### A.8 · Aceptados (marketing/logo — sin fix) — 12 casos

Todos con `shadow-sm` o `shadow-2xl` en `src/features/marketing/**` y
`BrandLockup.tsx`. Estas superficies usan su propia escala editorial y
`bg-white` fijo por identidad. Se documentan pero **no se tocan**:

- `BrandLockup.tsx:56`, `LogoPreview.tsx:78`, `LandingFooter.tsx:12`,
  `LandingNav.tsx:23`, `LandingPortal.tsx:57`, `LandingHero.tsx:68`.

---

## Sección B · Inventario de radios (fuera de UI kit)

**Total:** 14 ocurrencias · **En scope de fix:** 4 · **Aceptadas (marketing):** 10.

### B.1 · `rounded-2xl` en cards que NO usan `<Card>` shadcn — 3 casos · **HIGH**

**Rotura clara del kit**: `DesempenoOperadores.tsx` construye 3 "cards" con
`<Card className="rounded-2xl shadow-sm border-0 bg-card">`, sobreescribiendo
el radius canónico (`rounded-lg`), la sombra (`shadow-sm` en vez de
`shadow-card`) y quitando el borde. Cuando estas cards conviven con Cards
canónicas en la misma vista, se sienten "de otra app".

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| B1.1 | `src/features/operaciones/components/DesempenoOperadores.tsx` | 25 | `<Card className="rounded-2xl shadow-sm border-0 bg-card">` | `<Card>` (dejar defaults del kit) |
| B1.2 | `src/features/operaciones/components/DesempenoOperadores.tsx` | 42 | `<Card className="rounded-2xl shadow-sm border-0 bg-card">` | `<Card>` (dejar defaults) |
| B1.3 | `src/features/operaciones/components/DesempenoOperadores.tsx` | 59 | `<Card className="rounded-2xl shadow-sm border-0 bg-card">` | `<Card>` (dejar defaults) |

### B.2 · `rounded-2xl` en skeleton de KPI — 1 caso · Media

El skeleton no matchea el radius real del `<Card>` que aparecerá cuando
carguen los datos → salto visual al terminar de cargar.

| # | Archivo | Línea | Actual | Fix |
|---|---|---|---|---|
| B2.1 | `src/components/shared/skeletons/KpiGridSkeleton.tsx` | 44 | `<Skeleton key={i} className={cn("rounded-2xl", heightClass)} />` | `<Skeleton key={i} className={cn("rounded-lg", heightClass)} />` |

### B.3 · Aceptados (marketing — sin fix) — 10 casos

- `LogoPreview.tsx:134`, `GuiaPuertosMexico.tsx:92`, `GuiaIncoterms2020.tsx:160`,
  `GuiaCartaPorte.tsx:90`, `LandingPrecio.tsx:31 (rounded-3xl)`,
  `LandingPrecio.tsx:33`, `LandingPortal.tsx:35`, `LandingMexico.tsx:29`,
  `LandingHero.tsx:68`, `LandingDemo.tsx:36`.

Marketing usa una escala editorial con esquinas más redondeadas y sombras
propias (`shadow-[var(--shadow-overlay)]`) — **decisión de diseño**, se
mantiene.

---

## Sección C · Tabs custom

**Búsqueda técnica**: 0 ocurrencias de `aria-selected` o `role="tab"` fuera
de `@/components/ui/tabs`. 30 archivos usan el kit canónico. **No hay tabs
reimplementados desde cero.**

### C.1 · Segmented control custom con estilo `shadow-sm` en pill activo — 2 casos · Baja

Estos NO son tabs, son **segmented controls** hechos a mano. Cumplen su
función pero rompen el kit: el proyecto tiene `ToggleGroup` en shadcn y
otros lugares (por ejemplo `useEstadoTabs` en embarques) usan `Tabs` para el
mismo propósito.

| # | Archivo | Línea | Uso | Recomendación |
|---|---|---|---|---|
| C1.1 | `src/features/cliente/components/NuevoClienteFormPieces.tsx` | 75–92 | `ModoAltaTabs` (manual / CSF) | Reemplazar por `<ToggleGroup type="single">` de shadcn (bajo esfuerzo) |
| C1.2 | `src/features/marketing/components/sections/LandingPortal.tsx` | 57 | Selector "Cliente / Agente" del preview | Aceptado (landing, kit editorial) |

### C.2 · Observación de diseño en la barra fiscal (`/facturacion`) — no es violación

`BandejaTabs.tsx` **sí usa** `TabsList` y `TabsTrigger` canónicos. Lo que
llama la atención visualmente son los **encabezados de grupo** (`Preparar`,
`Cobrar`, `Histórico`) en gris pequeño encima de las tabs — un patrón único
en toda la app. Pequeños fixes:

| # | Archivo | Línea | Actual | Fix propuesto |
|---|---|---|---|---|
| C2.1 | `src/features/facturacion/components/bandejas/BandejaTabs.tsx` | 82 | `text-[10px] font-semibold uppercase tracking-wider` | `text-2xs font-semibold uppercase tracking-wider` (usa token existente) |
| C2.2 | `src/features/facturacion/components/bandejas/BandejaTabs.tsx` | 97 | `text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums` | `text-2xs font-semibold rounded-full px-1.5 py-0.5 tabular-nums` |

La agrupación de tabs en 3 microcategorías **puede quedarse** como
diferenciador de este módulo (aporta jerarquía cognitiva real: preparación
vs cobranza vs archivo). Si prefieres eliminarla para que la barra se sienta
100% igual a las demás, es una decisión de UX de mayor calado — la marco
como **pendiente para revisión aparte**.

---

## Sección D · Rincones adyacentes descubiertos

Durante el escaneo aparecieron dos micro-observaciones que no encajan en las
categorías anteriores pero merecen anotarse:

### D.1 · Uso de `text-[11px]` y `text-[10px]` en footers y microtexto — Baja

Detectados en `PortalLayout.tsx:52`, `AgenteLayout.tsx:120`,
`PortalBreadcrumbsBar.tsx:17` (`text-xs`) y `BandejaTabs.tsx:82,97`. El
sistema define `text-2xs (10px)` y `text-3xs (9px)`. Usar los tokens en vez
de valores arbitrarios.

### D.2 · `rounded-md` en `LeadsBulkBar` — Baja

`rounded-md` (6px) es válido en el kit (`--radius-sm`) pero para una barra
de acciones flotante el proyecto usa `rounded-lg` por consistencia visual
con el resto de barras stickies. Ver A5.2 arriba (fix combinado).

---

## Resumen priorizado para el Lote 2

**Alcance recomendado del Lote 2** (14 archivos, ~20 líneas):

### Bloque 2a · Cards hover unificadas (A.1) — 8 archivos
Reemplazo mecánico `hover:shadow-sm|md` → `hover:shadow-raised`. Sin riesgo.

### Bloque 2b · Headers sticky de portales (A.2) — 2 archivos
`shadow-sm` → `shadow-card`. Ya se tocaron en Lote 1 (buen momento para consolidar).

### Bloque 2c · Card wrapper custom en `DesempenoOperadores` (B.1) — 1 archivo
3 líneas: quitar clases y dejar `<Card>` puro. Riesgo bajo.

### Bloque 2d · Skeleton radius (B.2), tooltip sidebar (A.6), Timeline hover (A.5.1) — 3 archivos
Cambios puntuales de token.

### Bloque 2e · Botones/badges con shadow redundante (A.3, A.4, A.7) — 4 archivos
Quitar clases `shadow-sm/md` redundantes.

### Bloque 2f · Sticky bulk bar CRM (A.5.2) — 1 archivo
`shadow-lg rounded-md` → `shadow-raised rounded-lg`.

### Bloque 2g · Microtokens tipográficos en BandejaTabs (C2) — 1 archivo
`text-[10px]` → `text-2xs`.

### **Fuera del Lote 2** (requieren decisión de UX)

- **C1.1** `ModoAltaTabs` → `ToggleGroup`: implica reemplazo de componente,
  no solo clases. Va a un **Lote 3 posterior**.
- **Agrupación de tabs en `/facturacion`** (mantener/eliminar los encabezados
  de grupo): decisión de producto, no de código.

---

## Verificación pos-Lote 2 (checklist)

```bash
# Ninguna violación en scope:
rg -g '*.tsx' -g '!src/components/ui/**' -g '!src/features/marketing/**' \
  -g '!src/components/layout/BrandLockup.tsx' -g '!**/__tests__/**' \
  -e '\bshadow-(sm|md|lg|xl|2xl)\b' \
  -e '\brounded-(2xl|3xl)\b' \
  src/
```
Salida esperada: `0` resultados.

---

_Última actualización: v13.220.0_
