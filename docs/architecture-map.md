# Mapa de arquitectura — Libre Carga ERP

Actualizado: 8.195.0 (mayo 2026)

Este documento mapea cada dominio funcional a las capas que lo implementan,
para que cualquier ajuste sepa rápidamente dónde tocar.

## Capas y direcciones de import

```
pages/        → hooks/<dominio>      (controllers que componen UI)
hooks/        → services/<dominio>   (acceso a datos + react-query)
services/     → integrations/supabase (única capa con cliente SDK)
lib/          ← (puro, sin React)    (mappers, dominio, formatters, validation, io, utils)
components/   ← presentación pura    (consumen hooks; no llaman a supabase)
```

Reglas duras (ESLint `no-restricted-imports`):
- Pages/components importan SIEMPRE desde el barrel del dominio: `@/hooks/<dominio>` o `@/services/<dominio>`.
- Tablas siempre via `<DataTable />` salvo allowlist documentada en `eslint.config.js`.
- Sin `as any` (excepto changelogs estáticos).
- 0 llamadas a `supabase` desde `components/` o `pages/`.

## Mapa dominio → archivos

| Dominio | Pages | Hooks (controllers) | Services | Lib / domain |
|---------|-------|---------------------|----------|--------------|
| Embarques | `pages/embarques/*` | `hooks/embarque/*` | `services/embarque/{queries,mutations,eventos,documentos,contenedor,columns}` | `lib/mappers/embarque{FromDb,ToDb,Cotizacion}` · `lib/domain/embarque*` |
| Cotizaciones | `pages/cotizaciones/*` | `hooks/cotizacion/*` | `services/cotizacion/{queries,mutations,costos,wizard,conversiones/}` | `lib/mappers/{cotizacion,cotizacionForm}` |
| Facturación / Proformas | `pages/facturacion/*` | `hooks/facturacion/*` | `services/facturas/{proyeccion,huecoFacturacion,snapshots}` | `lib/domain/proyeccionFacturacion` |
| Clientes | `pages/clientes/*` | `hooks/cliente/*` | `services/cliente/*` | `lib/mappers/cliente*` |
| Proveedores | `pages/proveedores/*` | `hooks/proveedor/*` | `services/proveedor/*` | — |
| Auditoría | `pages/Auditoria.tsx` | `hooks/auditoria/*` | `services/auditoria/*` | `lib/ui/auditoriaConfig` |
| Operaciones | `pages/dashboard/Operaciones.tsx` | `hooks/operaciones/*` | (lee de embarque/queries) | — |
| Reportes | `pages/dashboard/Reportes.tsx` | `hooks/reportes/*` | (compone embarque + cliente) | `lib/financial/profitUtils` |
| Dashboard | `pages/dashboard/Dashboard.tsx` | `hooks/dashboard/*` | (agregaciones) | — |
| Portal cliente | `pages/portal/*` + `components/portal/*` | `hooks/portal/*` | RPCs públicas | — |
| Configuración | `pages/admin-org/Configuracion.tsx` | `hooks/configuracion/*` | `services/configuracion/*` + `services/admin/exportOrg` | `lib/io/{csv,zipDownload}` |
| Admin global | `pages/admin/*` | `hooks/admin/*` | `services/admin/{papelera,idempotencia,exportOrg,...}` | — |
| Catálogos | (inline en formularios) | `hooks/catalogos/*` | `services/catalogos/*` | — |
| Observabilidad | `components/shared/ErrorBoundary` | (sin hook) | `services/observability/logClientError` | — |
| Trazabilidad pública | `pages/auth/TrackingPublico.tsx` | — | edge function `tracking-public` | `lib/jsoncargo/*` |

## Utilidades transversales (`src/lib/`)

| Carpeta | Contenido |
|---------|-----------|
| `lib/utils/` | `cn()`, `escapeHtml()` — primitivas sin estado, importar como `@/lib/utils`. |
| `lib/io/` | CSV (RFC 4180) y descarga ZIP (JSZip + FileSaver). |
| `lib/formatters/` | Moneda MXN/USD/EUR, fechas DD/MM/YYYY (es-MX). |
| `lib/financial/` | Cálculos contables (IVA dinámico, profit, costos USD). |
| `lib/mappers/` | BD ↔ formularios. Helpers compartidos en `_helpers.ts`. |
| `lib/parsers/` | JSON ↔ tipos de UI (cotización detalle, dashboard). |
| `lib/csv/` | Importación CSV con zod (`importSchemas.ts`). |
| `lib/validation/` | Schemas zod para mutaciones críticas. |
| `lib/audit/` | `diffFields()` para bitácora. |
| `lib/contacto/` | Resolución de contactos cliente. |
| `lib/storage/` | URLs y paths de Supabase Storage. |
| `lib/supabase/cast.ts` | `fromDb<T>()`, `toDbJson()` — frontera de tipado. |
| `lib/ui/` | Tokens visuales, mappings de estado/feedback. |
| `lib/query/` | Configuración de react-query (gcTime, staleTime). |
| `lib/jsoncargo/` | Cliente y mappings de la API externa de tracking. |
| `lib/errors/` | Clases de error tipadas. |
| `lib/domain/` | Reglas de negocio puras por dominio. |

## Patrones obligatorios

- **Cleanup en effects**: cada `useEffect` con `supabase.channel`, `onAuthStateChange`, `addEventListener`, `setTimeout/setInterval` retorna cleanup. Para canales realtime usar `supabase.removeChannel(channel)`.
- **Estado local primero**: solo elevar a contexto/store cuando hay >1 consumidor.
- **Mappers puros**: nada de fetch dentro de `lib/mappers/*`.
- **Servicios sin React**: no `useEffect` ni `useState` en `services/*`.
- **Power of 10**: componentes ≤200 LOC, sin `any`, paginación en listas, complejidad ciclomática ≤15.

## Convenciones de nombres

| Patrón | Uso |
|--------|-----|
| `use<Recurso>` | Query simple (`useEmbarques`, `useCotizacion`). |
| `use<Recurso>Mutations` | Conjunto de mutations (`useCotizacionMutations`). |
| `use<Pantalla>Controller` | Composición de hooks para una página (`useEmbarquesPageController`). |
| `use<Pantalla>State` | Estado local complejo de una pantalla. |
| `fetch<Recurso>` | Función async pura en `services/`. |
| `build<X>Payload` | Mapper form → BD. |
| `map<X>RowToFormValues` | Mapper BD → form. |

## Cómo sumar un dominio nuevo

1. `services/<dominio>/{queries,mutations,index.ts}` — single source of truth con Supabase.
2. `hooks/<dominio>/{useX,useXMutations,index.ts}` — barrel obligatorio.
3. `lib/mappers/<dominio>.ts` si la forma de BD difiere del form.
4. `pages/<dominio>/*` y `components/<dominio>/*` consumen sólo barrels.
5. Tests mínimos: 1 suite en `services/__tests__` y 1 en `lib/mappers/__tests__`.
6. Agregar entrada al barrel correspondiente y al `mem://index.md` si aplica.
