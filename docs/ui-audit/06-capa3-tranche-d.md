# Capa 3 · Tranche D — Portales (Cliente + Agente)

Auditoría de las rutas externas del sistema. A diferencia de tranches A–C, aquí **no fue posible obtener screenshots autenticados** a 1920×1080: el usuario de auditoría (`hector@lopezbenavides.com`) no tiene rol `cliente` ni `agente`, por lo que las 10 rutas `/portal/*` y `/agente/*` redirigen a `/inicio` (verificado con Playwright). La auditoría se hizo **por revisión de código** contra los patrones canónicos establecidos en las tranches previas (`PageHeader`, `PageContainer`, tipografía H1, uso de `<Link>` para navegación, densidades, breadcrumbs). Cuando se apliquen los fixes de Lote 6, se pueden validar en preview manualmente o generando un usuario cliente de prueba.

**Rutas auditadas:**

- Portal Cliente: `/portal`, `/portal/embarques`, `/portal/embarques/:id`, `/portal/cotizaciones`, `/portal/cotizaciones/:id`, `/portal/facturas`, `/portal/facturas/:id`, `/portal/perfil`.
- Portal Agente: `/agente`, `/agente/tarifas`, `/agente/garantias`, `/agente/embarques`, `/agente/perfil`.

**Layouts:** `src/features/portal/components/PortalLayout.tsx`, `src/features/portal-agente/components/AgenteLayout.tsx`.

---

## Hallazgos

### 🔴 D-01 · HIGH · Detalles de portal cliente no usan `PageHeader`

**Rutas:** `/portal/embarques/:id`, `/portal/facturas/:id`, `/portal/cotizaciones/:id`.

Los tres archivos (`PortalEmbarqueDetalle.tsx:52-69`, `PortalFacturaDetalle.tsx:60-77`, `PortalCotizacionDetalle` vía `PortalCotizacionHeader`) construyen a mano headers con `<h1 className="text-xl sm:text-2xl">` o `text-2xl` + back-button + badges. La lista sí usa `PageHeader` — el detalle rompe el patrón.

**Impacto:** tipografía H1 divergente (`text-xl sm:text-2xl` en embarques, `text-2xl` en facturas, `text-display` en `PageHeader`), altura variable, espaciados inconsistentes.

**Fix propuesto:** migrar los tres detalles a `PageHeader` con `title=<expediente|numero|folio>`, `description=<meta info>`, `actions=<botones + back>`. El back-arrow puede quedar afuera (patrón `-ml-2 mb-2`) o dentro del slot `actions`, pero unificado.

---

### 🔴 D-02 · HIGH · `AgenteLayout` divergente de `PortalLayout`

**Archivo:** `src/features/portal-agente/components/AgenteLayout.tsx`.

Aunque ambos portales usan `BrandLockup + max-w-screen-2xl`, difieren en:

| Elemento | Portal Cliente | Portal Agente |
|---|---|---|
| Breadcrumbs bar | ✅ `<PortalBreadcrumbsBar />` | ❌ ausente |
| Bottom nav mobile | ✅ `<PortalBottomNav />` | ❌ ausente |
| `FeedbackButton` | ✅ | ❌ |
| Campana notificaciones | ✅ `<PortalNotificationsBell />` | ❌ |
| User menu (dropdown) | ✅ `<PortalUserMenu>` | ❌ (email + logout inline) |
| Chip organización en header | ❌ (subtitle) | ✅ `<Building2 />` chip |
| Footer con org dinámico | ✅ `{orgName ?? "Libre Carga"}` | ❌ hardcoded "Libre Carga" |

**Impacto:** dos experiencias externas con look-and-feel distinto, mismo espacio de marca.

**Fix propuesto:** extraer `PortalHeader`/`PortalUserMenu` a componentes reutilizables o duplicar la estructura en `AgenteLayout`. Al mínimo: agregar breadcrumbs bar, user-menu dropdown y footer con org dinámico.

---

### 🟠 D-03 · MED · `PortalCotizaciones` sin navegación accesible

**Archivo:** `PortalCotizaciones.tsx:90-134`.

Usa `<Card onClick={() => navigate(...)}>` — no es focusable con teclado ni tiene `role="link"` ni `aria-label`. En cambio `PortalFacturas.tsx:89-121` usa correctamente `<Card>` envolviendo `<Link>` con `focus-within:ring-2` y `aria-label`.

**Impacto:** accesibilidad rota + patrón inconsistente entre listados hermanos.

**Fix propuesto:** copiar el patrón `<Link aria-label>` de `PortalFacturas` a `PortalCotizaciones`. El botón anidado "Ver embarque" ya tiene `e.stopPropagation()`, se mantiene.

---

### 🟠 D-04 · MED · Filtros móviles inconsistentes entre listados de portal

**Archivos:** `PortalEmbarques`, `PortalCotizaciones`, `PortalFacturas`.

- Embarques: `<PortalFiltersBar>` (desktop) + `<PortalEmbarquesMobileFilters>` (sheet).
- Facturas: `<PortalFiltersBar>` (desktop) + `<PortalFacturasMobileFilters>` (sheet).
- **Cotizaciones:** sólo `<PortalFiltersBar hideOnMobile={false}>` — sin sheet móvil.

**Impacto:** en mobile la barra de cotizaciones ocupa más espacio y se ve distinto que embarques/facturas.

**Fix propuesto:** crear `PortalCotizacionesMobileFilters` reutilizando la plantilla existente y quitar `hideOnMobile={false}`.

---

### 🟠 D-05 · MED · Títulos con capitalización mixta en `/agente/*`

**Archivos:** `AgenteInicio.tsx:29`, `AgenteTarifas.tsx:53`, `AgenteGarantias.tsx:104`, `AgentePerfil.tsx:37`.

- `"Bienvenido, {nombre}"` — mezcla saludo con H1.
- `"Mis tarifas marítimas"` — minúscula tras "Mis".
- `"Carta garantía y demoras"` — OK.
- `"Mi perfil"` — minúscula.

vs portal cliente: `"Mis Embarques"`, `"Mis Cotizaciones"`, `"Mis Facturas"`, `"Mi Perfil"` (Title Case consistente).

**Fix propuesto:** unificar a Title Case ligero: `"Inicio"` para el dashboard, `"Mis Tarifas Marítimas"`, `"Carta Garantía y Demoras"`, `"Mi Perfil"`. El saludo `"Bienvenido, {nombre}"` va como `description` del `PageHeader`.

---

### 🟠 D-06 · MED · `PageHeader` sin icon-tile en portales

**Todos los portales.** En tranches A–C se estableció el patrón `icon-tile bg-accent/10` en `PageHeader` (Proveedores, Clientes, Costeo/Agentes tras Lote 5). Los portales pasan `title/description/actions` pero nunca `icon`, dando headers "más planos" que las páginas internas.

**Fix propuesto:** aplicar el icon-tile a cada `PageHeader` de listado y detalle:

```tsx
<PageHeader
  icon={<div className="grid size-9 place-items-center rounded-md bg-accent/10 text-accent"><Ship className="size-5" /></div>}
  title="Mis Embarques"
  ...
/>
```

Mapa:

| Ruta | Icono |
|---|---|
| `/portal/embarques*` | `Ship` |
| `/portal/cotizaciones*` | `FileText` |
| `/portal/facturas*` | `Receipt` |
| `/portal/perfil` | `User` |
| `/agente` | `LayoutDashboard` |
| `/agente/tarifas` | `FileText` |
| `/agente/garantias` | `ShieldCheck` |
| `/agente/embarques` | `Ship` |
| `/agente/perfil` | `User` |

---

### 🟠 D-07 · MED · `AgenteInicio` define un `KpiCard` local en vez de usar el compartido

**Archivo:** `AgenteInicio.tsx:69-78`.

Componente ad-hoc de 10 líneas con su propio estilo (`p-3`, `text-2xl font-semibold`) mientras `/inicio` interno y otros dashboards usan el `KpiCard` compartido de `@/components/shared/kpi/KpiCard` con tokens, tonos e iconos estandarizados.

**Fix propuesto:** reemplazar por el `KpiCard` shared con `tone="warning"` en lugar de la clase manual `border-warning/40 bg-warning/5`.

---

### 🟡 D-08 · LOW · Tipografía micro divergente (`text-2xs`, `text-[11px]`, `text-xs`)

**Rutas listado y detalle de portal cliente.**

Ejemplos:

- `PortalCotizaciones:97,101,105,109` — `text-[11px]` + `text-2xs` + `text-xs` en la misma card.
- `PortalFacturas:97,102,105,108` — idem.
- `PortalEmbarques:116,122` — `text-2xs` en badges de expedientes agrupados.

**Fix propuesto:** normalizar a `text-xs` (12px) para meta info y `text-2xs` sólo para chips en badges. Eliminar `text-[11px]` arbitrarios.

---

### 🟡 D-09 · LOW · Botón "Volver" inconsistente entre detalles

**Archivos:** `PortalEmbarqueDetalle` usa `<Button variant="ghost" size="icon">` con `ArrowLeft` sólo. `PortalFacturaDetalle` usa `<Button variant="ghost" size="sm" className="-ml-2">` con texto "Volver". `PortalCotizacionDetalle` delega a `PortalCotizacionHeader` (implementación propia).

**Fix propuesto:** unificar a `<Button variant="ghost" size="sm" className="-ml-2"><ArrowLeft /> Volver</Button>` colocado **antes** del `PageHeader`.

---

### 🟡 D-10 · LOW · Mezcla de `size-4` y `h-4 w-4` en `AgenteGarantias`

**Archivo:** `AgenteGarantias.tsx:92,109,111`.

Usa `size-4` en el botón "Configurar" pero `h-4 w-4` en el `Info` icon del banner. Otras rutas usan siempre `h-4 w-4`.

**Fix propuesto:** normalizar a `h-4 w-4` para toda la codebase (o adoptar `size-*` global, pero requiere una migración mayor).

---

### 🟡 D-11 · LOW · `AgenteTarifas` envuelve `DataTable` en `<Card>` innecesaria

**Archivo:** `AgenteTarifas.tsx:80-88`. `AgenteGarantias.tsx:118-128` y `AgenteEmbarques.tsx:85-93` hacen lo mismo.

`DataTable` ya viene con su borde/sombra estándar (`shadow-card`), envolver en otro `Card` genera doble borde. Ninguna tabla del app interno hace esto tras Lote 3.

**Fix propuesto:** eliminar el `<Card>` wrapper de las tres rutas.

---

### 🟡 D-12 · LOW · Footer del portal agente hardcodea "Libre Carga"

**Archivo:** `AgenteLayout.tsx:117`.

```tsx
<span>© {new Date().getFullYear()} Libre Carga · Portal del Agente</span>
```

Portal cliente ya lo hace dinámico con `orgName`. Debería consultar el nombre de la organización del agente igual que `AgenteLayout` ya lo hace en el header (`ctx.organizacionNombre`).

**Fix propuesto:** `© {year} {ctx?.organizacionNombre ?? "Libre Carga"} · Portal del Agente`.

---

## Propuesta · Lote 6

Agrupado por bloque, similar a lotes anteriores. Se puede aprobar total o por bloque.

| Bloque | Severidad | Hallazgos | Archivos afectados |
|---|---|---|---|
| **6a** | 🔴 HIGH | D-01, D-02 | ~5 archivos: 3 detalles de portal cliente + `AgenteLayout` + `PortalHeader` extracción parcial |
| **6b** | 🟠 MED | D-03, D-04, D-05, D-06 | ~7 archivos: rutas de listado portal y agente + nueva `PortalCotizacionesMobileFilters` |
| **6c** | 🟠 MED | D-07 | `AgenteInicio.tsx` |
| **6d** | 🟡 LOW | D-08, D-09, D-10, D-11, D-12 | ~6 archivos: normalizaciones tipográficas + wrappers + footer |

Total estimado: **~15 archivos**, `APP_VERSION` bump a `13.226.0` con entradas en `CHANGELOG.md` por bloque.

Después del Lote 6 se genera el reporte consolidado `99-resumen.md` con el delta antes/después de las 4 tranches (A, B, C, D).

## Cómo continuar

Responde una de:

- **"aplica Lote 6a"** — solo los HIGH (headers de detalle + paridad de layouts).
- **"aplica Lote 6 completo"** — todos los bloques 6a–6d.
- **"genera el resumen 99-resumen.md"** — cierra el ciclo sin aplicar cambios de código adicionales.
