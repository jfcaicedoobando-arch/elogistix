# Libre Carga

Plataforma SaaS multi-tenant para agentes de carga (freight forwarders) en México. Centraliza cotizaciones, embarques, facturación, portal de clientes, auditoría operativa y reportes.

> **Versión actual**: ver `src/constants/appVersion.ts` y el [`CHANGELOG.md`](./CHANGELOG.md).
> **Arquitectura y convenciones**: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> **Documentación de dominio**: [`docs/auditoria.md`](./docs/auditoria.md), [`docs/tables.md`](./docs/tables.md).
> **Diseño**: [`docs/design-system.md`](./docs/design-system.md).
> **Seguridad**: [`docs/security-checklist.md`](./docs/security-checklist.md), [`docs/rls-multitenant-audit.md`](./docs/rls-multitenant-audit.md), [`docs/riesgos-aceptados.md`](./docs/riesgos-aceptados.md).
> **Histórico de cambios pre-v13**: [`docs/changelog-archive.md`](./docs/changelog-archive.md).

---

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3 + shadcn/ui (read-only) + tokens HSL semánticos
- **Estado server**: TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Backend**: Lovable Cloud (Supabase) — Postgres + RLS + Storage + Edge Functions (Deno)
- **AI**: Lovable AI Gateway (Gemini para parsing de CSF, etc.)
- **Tests**: Vitest + Testing Library

## Módulos principales

- **Embarques**: ciclo de vida en 7 estados, wizard de alta/edición, tracking automatizado, documentos, P&L.
- **Cotizaciones**: wizard, conversión a embarques, P&L USD/MXN, generación de PDF.
- **Clientes / Proveedores**: alta con CSF parseado por IA, contactos, documentos onboarding.
- **Facturación**: proformas (regulares y consolidadas), proyección, conceptos venta/costo.
- **Auditoría operativa**: hallazgos por reglas (docs faltantes, márgenes, fechas), revisiones, asignación de responsables, snapshots diarios.
- **Operaciones / Reportes / Dashboard**: KPIs en vivo, distribución por cliente/estado, alertas de demora.
- **Portal de clientes**: vista white-label con embarques, cotizaciones y facturas del cliente final.
- **Admin (super-admin)**: gestión de organizaciones, planes, miembros e impersonación.

## Convenciones rápidas

- **Localización**: es-MX, fechas `DD/MM/YYYY`, moneda base **MXN** + vista USD (Frankfurter, cache 1h).
- **IVA**: nunca hardcodear — usar `useTasaIVA` y `lib/financial/financialUtils.ts`.
- **Multi-tenant**: toda fila de dominio lleva `organization_id`; RLS + `OrganizationContext` (org efectiva considera impersonación).
- **Roles**: en `public.user_roles` (global) y `organization_members` (por org). Nunca en `profiles` ni `auth.users`.
- **Hooks**: importar siempre desde el barrel del dominio (`@/hooks/embarque`, `@/services/cliente`, …).
- **Pages no tocan Supabase**: toda I/O pasa por hook → service → cliente Supabase.
- **Changelog**: cada cambio se registra en `src/content/changelog/v8/chunks/0.ts` + entrada eager en `src/content/changelogData.ts` + bump de `APP_VERSION` (SemVer; ver §19 de ARCHITECTURE.md).

## Desarrollo local

Requisitos: Node.js 22+ y `npm` o `bun`.
> Node 20 NO es compatible: `@supabase/realtime-js` requiere `WebSocket`
> nativo global (estable desde Node 22). Bajo Node 20 varias suites del
> proyecto `node` de Vitest fallan en collect. CI corre con Bun.

Build de producción: `npm run build` con sourcemaps requiere ~8 GB de RAM
(runners de CI: 16 GB). En entornos con ≤4 GB usar `npm run build:low-mem`
(sin sourcemaps; el bundle es funcionalmente idéntico).

```sh
git clone <repo-url>
cd librecarga
npm install
npm run dev
```

La app se sirve en `http://localhost:8080`. Las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) son provistas automáticamente por Lovable Cloud y viven en `.env` (no editar a mano).

### Cuenta demo (by design)

La plataforma expone una cuenta demo pública (`demo@librecarga.com`, contraseña fija `demo-libre-carga-2026`, definida en `supabase/functions/demo-access/index.ts`). Es **intencional**: habilita el botón "Ver demo" del login sin alta previa. Sus límites de seguridad, verificados en la auditoría 2026-07-29 (O9/S5-17):

- La sesión demo es rol `operador` sobre la **org demo**, aislada de los tenants reales por RLS (cobertura enforced en CI).
- La re-siembra (`seed_demo_organization`) solo es ejecutable por `service_role` o `super_admin` (guard M8); la edge `demo-access` la invoca con service key.
- Las credenciales NO son un secreto: no moverlas a vault ni rotarlas (el flujo del login depende de que sean estables). El riesgo residual aceptado es que cualquiera puede operar datos ficticios de la org demo; si eso deja de ser aceptable, la opción documentada es un proyecto de backend separado para demo, no credenciales secretas.

### Comandos útiles

```sh
npm run dev              # Servidor Vite
bunx vitest run          # Correr tests (279 tests)
bunx tsc --noEmit        # Type-check
npm run changelog:add    # Asistente para agregar entrada al changelog
```

## Estructura

```text
src/
├── pages/           Composición de UI por ruta (no tocan Supabase)
├── components/      Componentes por feature + shared/ + ui/ (shadcn read-only)
├── hooks/           React Query + estado local, organizado por dominio (barrels)
├── services/        Acceso puro a datos (Supabase, edge functions)
├── lib/             domain, mappers, parsers, financial, formatters, ui, query
├── contexts/        Auth, Organization, Theme, Breadcrumb
├── generators/      PDF / CSV
├── content/         Changelog y copy editorial
├── constants/       Constantes de dominio y appVersion
├── types/           Tipos compartidos
└── integrations/    Supabase client + types (auto-generados, NO editar)

supabase/
├── functions/       Edge Functions (Deno)
├── migrations/      SQL versionado (RLS, RPCs, triggers)
└── config.toml
```

Detalle completo y reglas de capa en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Edición desde Lovable

Este proyecto se desarrolla principalmente en [Lovable](https://lovable.dev). Los cambios hechos en el editor se commitean automáticamente al repo, y los pushes externos se reflejan en Lovable.

Para publicar: en Lovable → **Share → Publish**. Para conectar dominio propio: **Project → Settings → Domains → Connect Domain**.

---

## Despliegue y CI/CD

Es importante separar tres cosas que suelen confundirse:

1. **Frontend (lo que ven los usuarios)**: se publica **desde Lovable** con `Share → Publish → Update`. No hay comando de GitHub que lo publique; el botón es el único punto de publicación.
2. **Backend (base de datos, RLS, edge functions)**: se despliega **automáticamente** cuando Lovable detecta cambios en el código. Si una migración llega rota a `main`, puede romper producción sin avisar.
3. **`deploy-gate.yml` en GitHub**: no despliega nada. Es una **guardia de calidad** que corre después de cada merge a `main` y revisa que las migraciones, RLS, drift y la suite de RLS estén sanos. Piensa en él como el "seguro de viaje" que revisa el equipaje antes de que el avión despegue.

### Recomendación

- No eliminar el deploy gate. El proyecto ya tiene tests de RLS, migraciones auditadas y radar de drift; el gate asegura que esas protecciones signifiquen algo en producción.
- Para que sea efectivo, conviene configurarlo como **required status check** en GitHub:
  - `Settings → Branches → main → Require status checks to pass before merging`
  - Agregar `deploy-gate` (o los jobs individuales: `Gate — auditoría de migraciones`, `Gate — suite de RLS`, `Gate — radar de drift`).
- El deploy gate tampoco sustituye la revisión humana de un PR; solo valida reglas automáticas que ya están en el repo.

### Workflows principales

- `ci.yml`: lint, typecheck, tests, knip, bundle stats y seguridad en cada PR/push a `main`.
- `rls-tests.yml`: corre la suite de RLS de Supabase en cada cambio de base de datos.
- `deploy-gate.yml`: post-merge, verifica que `main` esté sano para producción.
- `e2e.yml`: pruebas end-to-end en staging (cuando se dispara).
- `post-deploy-smoke.yml`: verificaciones rápidas después de publicar.

