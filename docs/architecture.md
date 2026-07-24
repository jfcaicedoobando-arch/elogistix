> ⚠️ **OBSOLETO** — El canónico de arquitectura es [`ARCHITECTURE.md`](../ARCHITECTURE.md) (raíz del repo). Este documento se conserva por contexto histórico; la topología real vive en `src/features/<dominio>/`.

# Arquitectura — Libre Carga (histórico)

> Última actualización: v12.95.8. Ver `ARCHITECTURE.md` para la fuente vigente.

## 1. Capas y dirección de dependencias

```text
┌─────────────────────────────────────────────────────────────┐
│  Pages / Routes        (src/pages/**, src/features/*/routes)│
│      ▼ importan                                              │
│  Components            (src/components/**, features/*/comp.) │
│      ▼ importan                                              │
│  Hooks (React Query +  (src/hooks/**, features/*/hooks)      │
│   orquestación UI)                                           │
│      ▼ importan                                              │
│  Services              (src/services/**, features/*/services)│
│      ▼ importan                                              │
│  Lib / Domain (puro)   (src/lib/**, features/*/domain)       │
│      ▼ importan                                              │
│  Integrations          (src/integrations/supabase/client)    │
└─────────────────────────────────────────────────────────────┘
```

Reglas duras (verificadas por `src/lib/__tests__/architecture.test.ts`):

1. **Nadie** fuera de `src/services/**`, `src/features/*/services/**`,
   `src/contexts/**` y `src/integrations/**` puede importar
   `@/integrations/supabase/client`. Hooks, components y pages siempre pasan
   por un service.
2. Ningún archivo productivo puede superar **200 líneas** (Power-of-10).
   Excepciones (legacy) en `OVERSIZED_BASELINE`. Cualquier archivo nuevo > 200
   líneas hace fallar CI.
3. Cualquier `as unknown as` requiere comentario `// SAFE-CAST:` con
   justificación (ver `mem://principles/safe-cast`).
4. Si un dominio ya vive en `src/features/<dominio>/`, no puede aparecer en
   `src/{components,hooks,services,pages}/<dominio>` (shadow-folder guard).
   Allowlist en el test.

## 2. Estructura canónica por dominio

Para dominios nuevos, **siempre** folder-style:

```text
src/features/<dominio>/
  index.ts            # Barrel público (única superficie hacia afuera)
  routes/             # Páginas montadas en src/routes/*
  components/         # UI específica del dominio
  hooks/              # React Query + estado UI
  services/           # Acceso a Supabase / IO
  domain/             # Lógica pura, sin React ni Supabase
  types/              # Tipos compartidos del dominio
  constants/          # Constantes del dominio
  queryKeys.ts        # Factories de query keys
```

Dominios ya migrados: `auditoria`, `costeo`, `embarques`.

Dominios pendientes de migrar (layer-first → folder-style, plan iterativo en
`.lovable/plan.md` Paso 3): `proveedor`, `cxp`, `cotizacion`, `facturas`,
`cliente`, `crm`, `tesoreria`, `profit`, `presupuesto`, `comisiones`, `portal`.

## 3. Separación de concerns

| Capa | Puede hacer | NO puede hacer |
|---|---|---|
| `routes/` | Layout, breadcrumbs, suspense | Lógica de negocio, queries directas |
| `components/` | JSX, estado local de UI, callbacks | Llamar a Supabase, mutaciones globales |
| `hooks/` | `useQuery`, `useMutation`, derivar estado | JSX, `import "@/integrations/supabase/client"` |
| `services/` | Supabase, fetch, mapping a DTO | Hooks de React, JSX |
| `domain/` + `lib/` | Funciones puras, validación zod, cálculos | Side effects, React, Supabase |

## 4. Naming y convenciones

- Hooks: `useXxx`. Mutaciones: `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx`.
- Services: verbos (`fetchXxx`, `crearXxx`, `actualizarXxx`).
- Query keys: factory en `queryKeys.ts` del feature, jamás strings sueltos.
- Tipos de fila Supabase: re-export desde `features/<dom>/types/`.
- Componentes > 200 líneas → extraer subpartes a `<Componente>.<Subparte>.tsx`.

## 5. UI primitivas vs. dominio

- `src/components/ui/` contiene **solo** primitivas shadcn + wrappers neutrales
  (`date-picker-mx`, `ErrorDetailsDialog`). No agregar componentes con lógica
  de dominio aquí.
- `src/components/<dominio>/` está en proceso de migrar a
  `src/features/<dominio>/components/`.

## 5b. Regla de admisión a `src/lib/`

`src/lib/` es para **utilidades cross-dominio puras**. No es papelera de
lógica sin dueño. Un módulo solo entra a `src/lib/` si cumple **las dos**:

1. Es importado por **≥2 dominios distintos** (cross-cutting real).
2. **No tiene dominio dueño claro** (no es regla de negocio de un solo dominio).

Si pertenece a un dominio único → `src/features/<dominio>/domain/`.
Excepción: durante la migración layer-first → folder-style, lógica de un
dominio que aún no tiene `features/<dominio>/` puede vivir transitoriamente en
`src/lib/domain/<dominio>.ts`, documentando el plan de migración en la cabecera
del archivo.

## 5c. Convención `queries/` vs `mutations/` en `services/<dominio>/`

Cuando un dominio acumula **muchas operaciones de I/O**, separar lecturas y
escrituras en sub-carpetas mejora la legibilidad y facilita auditar permisos.
Aplicar la convención **`services/<dominio>/queries/` + `services/<dominio>/mutations/`**
(modelo: `src/services/cotizacion/`) cuando se cumpla **alguna** de estas:

1. ≥6 operaciones de escritura (`crear`, `actualizar`, `eliminar`, transiciones de estado).
2. Un único archivo del dominio supera **150 LOC mezclando reads y writes**.
3. Lecturas y escrituras tienen reglas RLS o caching radicalmente distintas.

Para dominios pequeños (≤4 funciones totales) **no forzar** el split — la
sobre-modularización genera ruido sin ganancia. Sub-carpetas por **subdominio
funcional** (ej. `services/facturas/{cobranza,exports,notasCredito}`) son
preferibles cuando la división natural es por feature, no por verbo.


## 6. Backend (Lovable Cloud / Supabase)

- Todas las tablas en `public` requieren `GRANT` explícito + RLS habilitada.
- Roles en tabla separada `public.user_roles` + `has_role()` SECURITY DEFINER.
- Edge functions en `supabase/functions/<nombre>/`, con `_shared/` para
  utilidades comunes (CORS, auth, logger).

## 7. Versionado y changelog

- Bump de `src/constants/appVersion.ts` por cada cambio productivo.
- Entrada en `CHANGELOG.md` (root) con formato `## [X.Y.Z] - YYYY-MM-DD`.
- No existe ruta `/changelog` ni `src/content/changelog/`.

## 8. Auditoría continua

- `bun run audit:all` genera `reports/audit-report.{md,json}`.
- Lefthook lo corre pre-push; queda pendiente blindarlo en GitHub Actions
  (Paso 9 del plan).
- Tests de arquitectura: `src/lib/__tests__/architecture.test.ts` y
  `src/lib/__tests__/architecture-baseline.test.ts`.

## 9. Referencias

- `mem://principles/power-of-10`
- `mem://principles/safe-cast`
- `mem://principles/inline-styles`
- `mem://technical/architecture-and-standards`
- `mem://technical/storage-rls-paths`
- `mem://audit/pendings`
