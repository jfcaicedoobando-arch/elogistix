# Libre Carga

Plataforma SaaS multi-tenant para agentes de carga (freight forwarders) en México. Centraliza cotizaciones, embarques, facturación, portal de clientes, auditoría operativa y reportes.

> **Versión actual**: ver `src/constants/appVersion.ts` y el [Changelog](./src/pages/dashboard/Changelog.tsx).
> **Arquitectura y convenciones**: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> **Documentación de dominio**: [`docs/auditoria.md`](./docs/auditoria.md), [`docs/tables.md`](./docs/tables.md).

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

Requisitos: Node.js 20+ y `npm` o `bun`.

```sh
git clone <repo-url>
cd librecarga
npm install
npm run dev
```

La app se sirve en `http://localhost:8080`. Las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) son provistas automáticamente por Lovable Cloud y viven en `.env` (no editar a mano).

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
