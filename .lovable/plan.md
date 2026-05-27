# Versión 11.66.0 — Cierre P1.5/P1.6 + P1.7 (Zod boundaries, hotspots)

## Contexto

Al revisar el estado real del código contra `.lovable/plan.md`:

- **P1.5 (unificar utils)** ya está satisfecha: existe sólo `src/lib/utils/` (con `index.ts` como barrel), no hay `src/utils/` ni `src/lib/utils.ts`. Los demás "utils" están bien segregados por dominio (`formatters/`, `io/`, `parsers/`, `validation/`).
- **P1.6 (servicios "god")** ya está satisfecha: los archivos citados (`facturas/proyeccion`, `cotizacion/mutations`, `useHuecoFacturacion`) hoy son carpetas modulares o archivos ≤55 líneas. Ningún servicio supera 200 líneas (mayor: `cliente/crud.ts` 174).
- **P1.7 (Zod en boundary Supabase)** sí tiene trabajo real: `fromDb()` ya acepta schema opcional, pero sólo se usa en 2 lugares (`services/embarque/mutations.ts`, `services/portal/queries.ts`). Los demás boundaries siguen con cast crudo `fromDb<T>()`.

Esta versión cierra los dos ítems ya satisfechos (con evidencia) y avanza P1.7 sobre los hotspots de mayor peso de riesgo según `audit-report.md`.

## Alcance

### 1. Cierre formal P1.5 y P1.6

- Actualizar `.lovable/plan.md`: mover P1.5 y P1.6 a "Cerrados" con nota corta de evidencia (sin trabajo de código).

### 2. P1.7 — Zod en 3 hotspots reales

Seleccionados por (a) peso de riesgo en `audit-report.md`, (b) ser boundary Supabase real (lectura → dominio), (c) tener forma estable y acotada:

| Hotspot | Razón |
|---|---|
| `src/lib/parsers/dashboard.ts` (peso 14) | Parser que ya hace `fromDb` crudo sobre RPC/joins del dashboard. Schema acotado. |
| `src/lib/mappers/embarqueToDb.ts` (peso 12) | Mapper bidireccional embarque ↔ row. Validar el shape de retorno endurece el wizard. |
| `src/services/embarque/queries/exportListado.ts` (peso 10) | Export CSV crítico. Si el shape cambia silenciosamente, el CSV sale corrupto. |

Para cada uno:

1. Definir un Zod schema **mínimo** (sólo campos que el consumidor realmente usa) co-ubicado en `src/lib/domain/` o junto al parser.
2. Sustituir el `fromDb<T>(data)` crudo por `fromDb(data, schema)`.
3. Garantizar manejo de `ZodError`: el error existente (toast/log) ya cubre `Error`; añadir test de fallo donde aplique.
4. Tests unitarios: 1 happy + 1 inválido por schema (3 schemas → ~6 tests).

### 3. Versión + changelog

- `src/constants/appVersion.ts` → `11.66.0`.
- `CHANGELOG.md`: entrada `[11.66.0]` con bullets de cierre P1.5/P1.6 y los 3 schemas adoptados.
- `.lovable/plan.md`: cerrar P1.5, P1.6, marcar P1.7 como **parcial** con los 3 hotspots cubiertos y lista de pendientes.

## Fuera de alcance

- No tocar guards/RLS/UI.
- No reescribir mappers; sólo añadir validación en el `fromDb`.
- No extender Zod a TODOS los boundaries (P1.7 sigue abierta como parcial — sólo cerramos hotspots).
- No tocar D13 (continuo) ni Cx (complejidad) — quedan para versiones siguientes.

## Detalles técnicos

- Schemas usan `z.object({...}).passthrough()` cuando el row trae más campos de los que consumimos (evita romper si Supabase añade columnas).
- Para arrays de filas: `z.array(rowSchema)`.
- IDs Supabase: `z.string().uuid()` salvo donde el código actual ya tolera strings cortos.
- Nada de `z.any()` ni `z.unknown()` — derrota el propósito.
- Reutilizar la infraestructura `fromDb` ya existente (no introducir wrapper nuevo).

## Verificación

- `bun test` (tests nuevos + suite completa).
- `audit-report.md` debe seguir con 0 HIGH/CRITICAL y 0 oversized.
- `architecture-baseline.test.ts` y `audit-report.test.ts` en verde.

## Entregables

- 3 schemas nuevos + adopción en 3 hotspots.
- ~6 tests nuevos.
- `appVersion.ts`, `CHANGELOG.md`, `.lovable/plan.md` actualizados.
