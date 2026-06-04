
# Reorganización a feature slice: `src/features/embarques/`

## Objetivo
Migrar el dominio de embarques de layout horizontal (components/hooks/pages/lib/types/services separados) a un **feature slice cohesivo** en `src/features/embarques/`, dejando todo el código relacionado co-ubicado y con imports limpios desde un barrel. Es un PR grande (~110 archivos movidos, ~18 consumidores externos actualizados) pero mecánico: rename + ajuste de paths. Sin cambios de comportamiento.

## Inventario detectado
- `src/components/embarque/` — 58 archivos (incluye subcarpetas `conceptos`, `contenedores`, `duplicarEmbarque`, `facturacion`, `proforma`, `secciones`, `stepDatosRuta`, `tabDocumentos`, `tabResumen`, `tracking`).
- `src/hooks/embarque/` — 38 archivos (controllers, queries, mutations, wizard).
- `src/pages/embarques/` — 4 páginas (lazy-loaded en `src/routes/appRoutes.lazy.ts`).
- `src/lib/domain/embarque.ts` + 8 archivos hermanos (`embarqueFases`, `embarqueWizard`, `embarqueWizardConstants`, `embarqueWizardCostos`, `embarqueWizardDocumentos`, `embarqueWizardRuta`, `embarqueWizardSchemas`, `embarqueWizardStepValidator`) + tests en `src/lib/domain/__tests__/`.
- `src/lib/embarque/embarquesPageHelpers.ts` + test.
- `src/types/embarque.ts` y `src/types/embarque/contenedor.ts`.
- `src/services/embarque/` — directorio completo (con tests, columns, contenedores, documentos, eventos, idempotencyClaimSchema, index).
- `src/lib/query/keys/embarques.ts`.
- `src/constants/embarqueConstants.ts`.
- 18 consumidores externos (portal, facturación, cotización, services, appFeedback).

## Estructura propuesta

```text
src/features/embarques/
├── index.ts                   # barrel público (API consumida desde fuera)
├── routes/                    # 4 páginas (antes src/pages/embarques)
│   ├── Embarques.tsx
│   ├── EmbarqueDetalle.tsx
│   ├── NuevoEmbarque.tsx
│   └── EditarEmbarque.tsx
├── components/                # los 58 componentes y sus subcarpetas, tal cual
│   ├── conceptos/
│   ├── contenedores/
│   ├── duplicarEmbarque/
│   ├── facturacion/
│   ├── proforma/
│   ├── secciones/
│   ├── stepDatosRuta/
│   ├── tabDocumentos/
│   ├── tabResumen/
│   ├── tracking/
│   ├── EmbarqueDetalleHeader.tsx
│   ├── EmbarqueWizardLayout.tsx
│   ├── embarqueColumns.tsx
│   └── … (resto)
├── hooks/                     # los 38 hooks (controllers, mutations, queries, wizard)
│   ├── mutations/
│   ├── __tests__/
│   └── …
├── domain/                    # ex src/lib/domain/embarque*.ts + src/lib/embarque/embarquesPageHelpers.ts
│   ├── embarque.ts
│   ├── embarqueFases.ts
│   ├── embarqueWizard.ts
│   ├── embarqueWizardConstants.ts
│   ├── embarqueWizardCostos.ts
│   ├── embarqueWizardDocumentos.ts
│   ├── embarqueWizardRuta.ts
│   ├── embarqueWizardSchemas.ts
│   ├── embarqueWizardStepValidator.ts
│   ├── embarquesPageHelpers.ts
│   └── __tests__/             # tests movidos desde src/lib/domain/__tests__ y src/lib/embarque/__tests__
├── services/                  # ex src/services/embarque/* (mantiene reglas de arch: services no importan hooks/components/pages/contexts)
│   ├── index.ts
│   ├── columns.ts
│   ├── contenedor.ts
│   ├── contenedores/
│   ├── dashboardOperador.ts
│   ├── documentos.ts
│   ├── documentos/
│   ├── eventos.ts
│   ├── idempotencyClaimSchema.ts
│   └── __tests__/
├── types/                     # ex src/types/embarque.ts + src/types/embarque/
│   ├── index.ts               # re-export del antiguo embarque.ts
│   └── contenedor.ts
├── constants/                 # ex src/constants/embarqueConstants.ts
│   └── embarqueConstants.ts
└── queryKeys.ts               # ex src/lib/query/keys/embarques.ts
```

### Barrel `src/features/embarques/index.ts`
Expone sólo lo que se consume desde **fuera** del feature (lazy components para rutas, hooks usados por portal/facturación, tipos públicos, query keys). Imports internos del feature siguen usando paths relativos para evitar ciclos.

```ts
// Routes
export { default as Embarques } from "./routes/Embarques";
export { default as EmbarqueDetalle } from "./routes/EmbarqueDetalle";
export { default as NuevoEmbarque } from "./routes/NuevoEmbarque";
export { default as EditarEmbarque } from "./routes/EditarEmbarque";
// Hooks reusados externamente (portal, facturación)
export { useEmbarques } from "./hooks/useEmbarques";
export { useProformas } from "./hooks/useProformas";
// … (lista cerrada, no `export *`)
// Tipos
export type * from "./types";
// Query keys
export { embarquesKeys } from "./queryKeys";
```

## Reglas de arquitectura — actualización mínima

`src/lib/__tests__/architecture.test.ts` hoy prohíbe que `src/lib/**` importe de `@/hooks|@/components|@/pages`, y que `src/services/**` importe de `@/hooks|@/components|@/pages|@/contexts`. Hay que **extender** ambas reglas para que `src/features/<x>/domain/**` y `src/features/<x>/services/**` cumplan las mismas garantías:

- `src/features/*/domain/**` no puede importar de `@/hooks|@/components|@/pages|@/features/*/hooks|@/features/*/components|@/features/*/routes`.
- `src/features/*/services/**` no puede importar de hooks/components/pages/contexts (igual que `src/services`).
- Espejar las mismas reglas en `eslint.config.js` (`no-restricted-imports`) para que ESLint también las detecte en dev.

## Migración (ejecución)

Pasos atómicos, todos en un solo PR para no dejar el repo en estado intermedio inconsistente:

1. **Crear estructura vacía** `src/features/embarques/{components,hooks,domain,services,types,constants,routes}` y `index.ts`.
2. **Mover archivos** (con `git mv` lógico vía las herramientas de edición — rename + reescritura de contenido si hace falta). El contenido NO cambia salvo imports.
3. **Reescribir imports internos** del feature a paths relativos (`../domain/embarque`, `./hooks/useEmbarqueForm`, etc.). Esto resuelve referencias cruzadas dentro del slice sin pasar por el barrel (evita ciclos).
4. **Reescribir imports externos** (18 archivos identificados) hacia el barrel o hacia la subruta pública: `@/features/embarques`, `@/features/embarques/types`, `@/features/embarques/queryKeys` según corresponda.
5. **Actualizar rutas lazy** en `src/routes/appRoutes.lazy.ts` a `@/features/embarques/routes/*`.
6. **Borrar carpetas viejas vacías**: `src/components/embarque/`, `src/hooks/embarque/`, `src/pages/embarques/`, `src/lib/embarque/`, `src/services/embarque/`, `src/types/embarque/`, archivos sueltos `src/lib/domain/embarque*.ts`, `src/types/embarque.ts`, `src/constants/embarqueConstants.ts`, `src/lib/query/keys/embarques.ts`.
7. **Extender** `architecture.test.ts` + `eslint.config.js` con las reglas para `src/features/*`.
8. **Actualizar `ARCHITECTURE.md`** con la sección "Feature slices" describiendo la nueva convención y marcando embarques como el primero migrado.
9. **Bump version** a `12.54.0` (cambio estructural mayor sin romper API) + entrada en `CHANGELOG.md`.

## Verificación
- `vitest run` completo — todos los tests deben pasar sin tocar lógica (tests se mueven junto a su sujeto).
- `architecture.test.ts` con reglas extendidas debe pasar.
- TypeScript build limpio.
- Smoke en preview: `/embarques`, `/embarques/nuevo`, `/embarques/:id`, `/embarques/:id/editar`, portal embarques, facturación → proformas.

## Riesgos y mitigaciones
- **Volumen (~110 archivos)**: cualquier import mal reescrito rompe la build. Mitigación: hacer la reescritura con búsquedas regex acotadas por prefijo (`@/components/embarque/` → `@/features/embarques/components/`, etc.) y verificar con `tsc --noEmit` antes de cerrar.
- **Ciclos de import**: el barrel `index.ts` re-exporta cosas que internamente se referencian; resolverlo con paths relativos dentro del feature (regla: nada dentro de `src/features/embarques/**` importa de `@/features/embarques`).
- **Co-localización de tests**: los `__tests__` se mueven con su sujeto; los imports `@/lib/domain/embarque` dentro de tests se ajustan a `../embarque`.
- **Otros features quedan al estilo viejo**: documentado en `ARCHITECTURE.md` como "migración progresiva, embarques primero". No es objetivo de este PR migrar clientes/cotizaciones/etc.
- **`src/services/embarque` ya existe como módulo aislado**: su contenido no cambia, sólo se mueve; las reglas de arch siguen aplicando.

## Lo que NO se hace
- No se renombran símbolos ni se cambia lógica.
- No se migran otros dominios (clientes, cotización, facturación, CRM) — quedan para PRs siguientes siguiendo el mismo patrón.
- No se introduce un `index.ts` por subcarpeta interna (sólo el barrel raíz del feature).
- No se cambia `src/lib/financial/embarqueKpis.ts` (es financiero genérico, no del feature).
