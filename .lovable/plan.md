## Landing pública de Libre Carga

Objetivo: en la raíz `/` mostrar una landing pública que presente Libre Carga, ofrezca acceso gratuito a forwarders mexicanos, y guíe al visitante a **Probar demo** o **Crear cuenta gratis**. Los usuarios ya autenticados siguen viendo su Dashboard sin cambios.

### 1. Ruteo

Hoy `/` está dentro de `appRoutes` y muestra `<Dashboard />` detrás del guard. Para que la raíz sea pública sin romper enlaces internos:

- Crear `src/pages/marketing/Landing.tsx` (público).
- Crear `src/pages/RootGate.tsx`: si hay sesión → `<Navigate to="/dashboard" replace />`; si no → `<Landing />`.
- En `appRoutes.tsx`: cambiar `path="/"` por `path="/dashboard"` apuntando al mismo `<Dashboard />` (alias, mismo guard).
- En `publicRoutes.tsx`: añadir `<Route path="/" element={<RootGate />} />` (antes del `*`).
- Ningún enlace interno se rompe: no hay `to="/"` apuntando al dashboard explícitamente (los logueados aterrizan en `/dashboard` después de login). Ajustar `Login` para redirigir a `/dashboard` en vez de `/`.

### 2. Estructura de la landing (single-page, full-width sections)

1. **Nav fija translúcida** — logo `librecarga-logo.svg`, links ancla (Producto, Módulos, Precio, FAQ), botones **Ver demo** y **Crear cuenta gratis**.
2. **Hero** — eyebrow "Hecho en México 🇲🇽 · Gratis para siempre", H1 "El sistema operativo de tu agencia de carga", subtítulo (cotizar, embarcar, facturar y cobrar desde un solo lugar), dual CTA (Demo + Registro), mockup del dashboard a la derecha (placeholder gradient + chips de KPIs).
3. **Tira de logos / social proof** — "Usado por forwarders en CDMX, Manzanillo, Veracruz, Monterrey, Guadalajara…" (texto estilizado, sin logos falsos).
4. **3 KPIs marquee** — "−70% tiempo en cotizar · 100% trazabilidad de embarques · 0 hojas de Excel".
5. **Módulos** (6 cards en grid 3×2 dentro de banda full-width) — Cotizaciones, Embarques (Marítimo/Aéreo/Terrestre), Proformas & Facturación CFDI, CxC/CxP/Tesorería, Portal del Cliente, CRM & Comisiones. Cada card: icono lucide, título, 1 línea, mini-bullets.
6. **Cómo funciona** — 3 pasos (Cotiza → Opera → Cobra) con líneas que conectan.
7. **Hecho para México** — bandas con: facturación con IVA dinámico, MXN/USD con tipo de cambio diario (Frankfurter), UN/LOCODE, puertos MX prioritarios, fechas DD/MM/YYYY, multi-tenant seguro.
8. **Portal del cliente** — split: copy + mockup del portal (gráficas stacked + lista de embarques).
9. **Seguridad & confianza** — RLS multi-tenant, bitácora de actividad, roles, respaldos, edge functions auditadas.
10. **Precio** — card única "Gratis para forwarders mexicanos" con bullets de lo incluido y disclaimer ("Sin tarjeta, sin límite de usuarios durante el lanzamiento").
11. **FAQ** — acordeón con 6 preguntas (¿Es realmente gratis? ¿Mis datos están aislados? ¿Puedo migrar mis embarques actuales? ¿Funciona en móvil? ¿Soporte? ¿CFDI 4.0?).
12. **CTA final** — banda oscura full-width con dual CTA.
13. **Footer** — logo, links, contacto, copyright, links legales placeholder.

### 3. CTAs (funnel "Demo guiada + registro")

- **Probar demo** → `/login?tab=demo` (variante outline). El Login ya existe; si no tiene tab demo, el botón sólo lleva a `/login` y mostramos copy "usa el botón Demo".
- **Crear cuenta gratis** → `/login?tab=signup` (variante primary, accent #2563EB).
- Ambos CTAs aparecen en nav, hero, sección portal y banda final.

### 4. Diseño visual (Navy Trust + Inter)

- Tokens: respetar `--primary` (#1B2B4B) y `--accent` (#2563EB) ya definidos; fondo `#F8FAFC`, secciones alternando `bg-background` / `bg-muted/30` / banda oscura `bg-primary text-primary-foreground` para hero y CTA final.
- Tipografía: Inter (ya activa). H1 ~clamp(2.5rem, 5vw, 4rem), tracking ajustado.
- Gradientes sutiles en hero (`from-primary via-primary to-[#1e3a5f]`) y blobs decorativos blur.
- Border radius `--radius` ya definido, sombras suaves para cards.
- Iconos: `lucide-react` (Ship, Plane, Truck, FileText, Wallet, Users, ShieldCheck, Globe).
- Responsive mobile-first: nav colapsa a sheet, hero apila, grids se vuelven 1 col.

### 5. SEO

- `react-helmet-async` ya disponible o instalar; si no lo está, editar `index.html` directamente (sitewide).
- `<title>`: "Libre Carga — Software gratis para agencias de carga en México" (<60).
- `<meta description>`: "Cotiza, embarca, factura y cobra desde un solo lugar. Hecho para forwarders mexicanos. Gratis." (<160).
- `<link rel="canonical" href="https://librecarga.com/">`.
- og:title, og:description, og:url, og:type=website.
- JSON-LD Organization + SoftwareApplication (precio 0 MXN).
- H1 único en hero; H2 por sección.
- `lang="es-MX"` en `<html>`.
- Sin og:image por ahora (evitar placeholder).

### 6. Archivos a crear/editar

**Crear:**
- `src/pages/marketing/Landing.tsx` (orquestador, ≤200 líneas).
- `src/pages/marketing/sections/LandingNav.tsx`.
- `src/pages/marketing/sections/LandingHero.tsx`.
- `src/pages/marketing/sections/LandingModulos.tsx`.
- `src/pages/marketing/sections/LandingComoFunciona.tsx`.
- `src/pages/marketing/sections/LandingMexico.tsx`.
- `src/pages/marketing/sections/LandingPortal.tsx`.
- `src/pages/marketing/sections/LandingSeguridad.tsx`.
- `src/pages/marketing/sections/LandingPrecio.tsx`.
- `src/pages/marketing/sections/LandingFaq.tsx`.
- `src/pages/marketing/sections/LandingCtaFinal.tsx`.
- `src/pages/marketing/sections/LandingFooter.tsx`.
- `src/pages/marketing/landingCopy.ts` (todos los textos centralizados en es-MX).
- `src/pages/RootGate.tsx`.

**Editar:**
- `src/routes/publicRoutes.tsx` — añadir `/` → RootGate.
- `src/routes/appRoutes.tsx` — `/` → `/dashboard` (alias).
- `src/pages/auth/Login.tsx` — redirect post-login a `/dashboard` en lugar de `/`.
- `index.html` — title, meta description, canonical, og:*, JSON-LD, `lang="es-MX"`.
- `CHANGELOG.md` — entrada nueva.
- `src/constants/appVersion.ts` — bump a `12.52.0` (feature minor).

### 7. Fuera de alcance (no se hace en este plan)

- Imágenes generadas / hero illustration real (usaremos mockups CSS).
- Nuevas páginas legales (Aviso de privacidad, Términos): se dejan links placeholder en footer.
- Multi-idioma: sólo es-MX.
- Cambios de copy o flujo dentro del Login.
- Página `/precios` separada — todo vive en la landing.
- Tracking de analítica (GA, Plausible).

### 8. Verificación

- `npm run build` corre automático.
- Verificar visualmente: `/` muestra Landing sin sesión; con sesión redirige a `/dashboard`. Ambos CTAs llevan a `/login`. Sin overflow horizontal. Mobile 375px OK.
