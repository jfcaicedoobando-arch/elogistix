# Arquitectura de Libre Carga

Revisada el **2026-09-26** contra el repositorio. No certifica la configuración
ni el esquema desplegados en producción.

## Stack y capas

SPA: React 19, Vite 8, TypeScript 6 estricto, Router 7 declarativo
(`BrowserRouter`, nuqs v7) y Tailwind 3. No SSR, TanStack Start ni Router framework mode.

```text
páginas / componentes
        ↓
hooks / controladores
        ↓
servicios / mappers
        ↓
Supabase Data API / RPC / Edge Functions
        ↓
PostgreSQL / Storage / integraciones externas
```

## Organización

| Lugar | Responsabilidad |
| --- | --- |
| `src/routes/`, rutas de cada feature | Declaración/guards y composición de pantallas |
| `src/features/<feature>/components/` | UI/eventos, no acceso directo a Supabase |
| `src/features/<feature>/hooks/` | Estado, queries, coordinación e invalidación |
| `src/features/<feature>/services/` | I/O y adaptación de respuestas |
| `src/features/<feature>/domain/` | Cálculos, validaciones y mappers propios |
| `src/lib/domain/` | Reglas puras compartidas por varios dominios |
| `src/components/shared/` | Patrones UI transversales |
| `src/components/ui/` | Primitivas Radix/shadcn adaptadas |
| `src/lib/contexts/` | Contextos transversales |
| `src/integrations/supabase/` | Cliente y tipos generados |
| `src/pdf/`, `src/generators/` | Documentos y preparación de datos |

Consumir las APIs públicas del feature cuando existan. No reintroducir las
carpetas raíz antiguas `src/hooks/<dominio>` / `src/services/<dominio>` / `src/pages/`.
Las excepciones exigidas se consultan en `eslint.config.js` y pruebas de arquitectura.

## Separación de responsabilidades

- Páginas componen; no consultan tablas ni recalculan saldos.
- Hooks administran estado/cache y llaman servicios.
- Servicios devuelven datos/errores; no muestran toast ni navegan.
- Dominio puro calcula/valida; no hace I/O.
- Operaciones sobre varios registros usan RPC transaccional o caso de uso servidor.
- Servidor valida sesión, organización y permiso; un botón oculto no lo reemplaza.
- Tipos generados de Supabase no se editan a mano.

Power of 10 favorece unidades revisables de hasta 200 líneas productivas según
los guardrails y excepciones documentadas. Extraer responsabilidades cohesivas,
no fragmentar artificialmente para cumplir un número.

## Estado, queries y errores

Claves en `queryKeys.ts` por feature y helpers de `src/lib/query/`. Incluir
organización, filtros, página y orden cuando identifican la consulta.
La configuración global está en `src/lib/query/queryClient.ts`.

Invalidar todas las vistas afectadas por una mutación: detalle, bandejas,
totales y portales. Un error de carga no es un estado vacío: propagar `isError`
y `refetch`, usar `ErrorState` / `ErrorStateInline` o `DataTable` con `onRetry`.
La [ADR de red](docs/adr/ADR-001-network-error-handling.md) recoge la intención;
el comportamiento actual está en `queryErrorReporting.ts` y
`src/lib/ui/appFeedback.ts`.

Usar `src/lib/browserStorage/` para persistencia del navegador. Nunca guardar
credenciales en documentos o evidencia de auditoría.

## Tipos y boundaries

`tsconfig.app.json` activa `strict`, `strictNullChecks`, `noImplicitAny`,
`noUnusedLocals`, `noUnusedParameters` y `noFallthroughCasesInSwitch`.

Validar datos externos con Zod/guards donde corresponda. Un cast, incluido
`fromDb<T>()` sin schema, no valida runtime. Preferir narrowing/mappers a
`as unknown as`. Las excepciones requieren justificación y pruebas.
Ver [TypeScript](docs/strict-mode-roadmap.md) y [casts](docs/cast-audit.md).

## UI

El [sistema de diseño](docs/design-system.md) define tokens, densidad y estados.
[ColumnDef](docs/datatable-columndef-guide.md) es el contrato de tablas;
la API legacy fue retirada.

Preferir `PageContainer`, encabezados compartidos, `DataTable`,
`ResponsiveDataTable` y `FormDialogShell`. Las primitivas están adaptadas:
no sobrescribir cambios locales al actualizar shadcn.

Validar **1280×720**, **691×763**, claro/oscuro, sidebar abierto/colapsado,
teclado y modales largos. No anidar controles. Los labels deben apuntar al
control DOM real; el `FormField` compartido asocia Radix Select a su trigger.

## Dinero, IVA y documentos

- Identificar moneda del documento, pago, cuenta y reporte.
- Comparar/importar sólo después de homogeneizar moneda y fecha de conversión.
- No convertir históricos con TC actual ni sustituir TC ausente por cero/uno.
- Formatear con `src/lib/formatters/`; no calcular sobre strings formateados.
- No objeto (SAT 01), Exento y tasa 0% son distintos.
- Preservar tratamiento, tasa, impuestos y retenciones del renglón/snapshot.
  Datos fiscales indeterminados requieren elección explícita.
- PPD admite mezcla 16% + No objeto. REP usa `complements` tipo `pago`,
  no XML manual `custom`.
- `paymentSummary` de FacturAPI es autoridad antes del REP; divergencia bloquea
  timbrado sin borrar el cobro bancario.
- `pending`/202 no es CFDI válido. Reconciliar el mismo intento/idempotency key;
  no reemitir a ciegas tras timeout.

Ver [facturación](docs/flujo-facturacion.md), [FacturAPI](docs/facturapi-go-live.md),
[CxP](docs/flujo-cxp-aprobacion.md) y [anticipos](docs/flujo-anticipos-proveedor.md).

## Backend y releases

Migraciones aplicadas son inmutables. Los espejos de `supabase/schema/` y
baseline son referencia revisable, no prueba del estado de Live.
Una corrección requiere migración nueva posterior a la última definición,
espejo y baseline/manifiesto cuando correspondan.

SDK fiscal, secretos y validaciones viven en backend, con helpers de
`supabase/functions/_shared/`. Separar Test/Live y verificar webhooks remotos.
Una limpieza documental no autoriza repair, squash, seeds ni cambios de datos.

La [guía CI](docs/ops/ci.md) describe las suites. Vitest 5 usa proyectos
node/jsdom explícitos; RLS se prueba en Postgres efímero.
Versionado en `src/constants/appVersion.ts` e historial en `CHANGELOG.md`.
Merge, deploy backend y publicación frontend se comprueban por separado.

## Documentación

El [índice](docs/README.md) distingue guías e historial.
Las reglas persistentes de Lovable viven en `.lovable/memories/`.
Los planes temporales retirados son recuperables en Git: retirarlos no
declara sus hallazgos cerrados ni autoriza implementar pendientes.
