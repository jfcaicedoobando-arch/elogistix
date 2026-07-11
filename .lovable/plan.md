## Objetivo

Migrar dos majors no bloqueadas por Lovable: **react-day-picker 8 → 10** y **zod 3 → 4**, dejando lint/typecheck/build/tests en verde y `APP_VERSION` bumpeada con entrada en `CHANGELOG.md`.

Analogía: es como cambiar dos electrodomésticos que comparten el mismo enchufe — hay que revisar cada cable que sale (usos en la app) y ajustar el interruptor (tests) antes de volver a encender la casa.

---

## Paso 1 — Rama de trabajo y baseline

1. Confirmar verde actual: `bun run lint`, `bun run typecheck`, `bun run test:fast`, `bun run build`.
2. Guardar el resultado como referencia para comparar al final.

## Paso 2 — react-day-picker 10

**Instalar**
```
bun add react-day-picker@^10
```

**2.1 Reescribir `src/components/ui/calendar.tsx`** para la API v9/v10:
- `classNames`: renombrar claves — `caption` → `month_caption`, `caption_label` → `caption_label` (igual), `nav_button*` → usar `button_previous` / `button_next` y `nav`, `head_row` → `weekdays`, `head_cell` → `weekday`, `row` → `week`, `cell` → `day`, `day` → `day_button`, `day_selected` → `selected`, `day_today` → `today`, `day_outside` → `outside`, `day_disabled` → `disabled`, `day_hidden` → `hidden`, `day_range_middle` → `range_middle`, `day_range_end` → `range_end`.
- `components`: reemplazar `IconLeft` / `IconRight` por `Chevron` (recibe `{ orientation }` y devuelve el ícono correcto).
- Verificar visualmente con captura Playwright de un `Popover` con calendario abierto.

**2.2 Eliminar prop `initialFocus`** (removida en v9) en 7 archivos:
- `src/components/ui/date-picker-mx.tsx`
- `src/components/ui/date-time-picker-mx.tsx`
- `src/features/auditoria/components/asignarResponsable/FechaLimitePicker.tsx`
- `src/features/auditoria/components/HallazgosFiltros.parts.tsx` (2 usos)
- `src/features/cotizacion/components/seccionRuta/NoMaritimoFields.tsx`
- `src/features/cotizacion/components/SeccionCondicionesComerciales.tsx`

Sustituir por `autoFocus` (equivalente v10) donde el foco al abrir sea deseado.

**2.3 Verificar**: `bun run typecheck` — debe compilar sin referencias a los tipos removidos. Playwright de un flujo con fecha (wizard embarque paso 2) para validar que abrir/seleccionar funciona.

## Paso 3 — zod 4

**Instalar**
```
bun add zod@^4
```

**3.1 Cambios de API en código productivo**
- Revisar cualquier uso de `.errors` en `ZodError` → ahora es `.issues` (ya usamos `issues` en `classifyError` y `firstZodMessage`, revisar el resto con `rg "\.errors\b" src`).
- Revisar `z.string().email()` — en v4 sigue existiendo pero los mensajes cambiaron; confirmar que no dependemos del texto exacto salvo en tests.
- Revisar `.default(...)` sobre objetos: en v4, `parse({})` con schema `z.object({...}).default({})` requiere que el objeto interior tenga defaults completos (esto rompió `crear.test.ts` antes). Auditar `src/lib/validation/mutationSchemas.ts` y `configSchemas.ts` — añadir `.default()` explícitos por campo donde falte.
- `z.preprocess` sigue existiendo; validar los schemas del dashboard.

**3.2 Ajustar tests que dependen del texto de error**
- `src/features/cotizacion/services/mutations/__tests__/crear.test.ts`: los mensajes esperados (`/mínimo 1/`, `/máximo 365/`, `/Subtotal/`, `/Modo/`, `/Cotización/`) provienen de `parseOrThrow` en `src/lib/validation/mutationSchemas.ts`. Confirmar que los mensajes custom se preservan; si zod 4 cambia el prefijo del path, actualizar `parseOrThrow` para seguir emitiendo el contexto `"Cotización: <campo> — <razón>"`.
- `src/features/dashboard/domain/parsers/__tests__/dashboardSchemas.test.ts`: los casos con `"no-numero"` deben seguir fallando (safeParse → success:false). Si zod 4 cambia `z.coerce.number()` para hacer coerce laxo, cambiar por `z.number()` con `preprocess` custom que rechace strings no numéricos.
- `src/lib/validation/__tests__/mutationSchemas.test.ts` y `src/lib/observability/__tests__/classifyError.test.ts`: correr y ajustar si algún mensaje cambia.

**3.3 Suite completa**
- `bun run test:fast` primero (rápido), luego `bun run test` si es necesario.
- Ajustar snapshots que dependan de mensajes de zod.

## Paso 4 — Verificación final

En orden:
1. `bun run lint -- --max-warnings 0`
2. `bun run typecheck`
3. `bun run test:fast`
4. `bun run build`
5. Playwright manual: abrir un date-picker en el wizard de embarques y crear una cotización mínima para validar el flujo real.

## Paso 5 — Versionado

- `APP_VERSION` → `13.254.0` (major-bump interno por dos majors de dependencias).
- Añadir entrada en `CHANGELOG.md` root:
  ```
  ## [13.254.0] - 2026-07-11
  - Migración react-day-picker 8 → 10 (calendar classNames v9, Chevron component, autoFocus).
  - Migración zod 3 → 4 (issues API, defaults explícitos, mensajes preservados vía parseOrThrow).
  ```

## Riesgos y mitigación

- **Regresión visual del calendario**: mitigar con captura Playwright antes/después.
- **Mensajes de zod distintos**: los tests que hoy hacen `toThrow(/regex/)` se apoyan en `parseOrThrow` para el prefijo; si zod 4 cambia el mensaje base, ajustamos el catálogo, no el test.
- **`z.coerce.number()` demasiado permisivo**: si `"no-numero"` deja de fallar, reemplazamos por `z.number()` + `preprocess` que rechace explícitamente.

## Rollback

Si algún paso queda rojo y no se resuelve en el turno: revertir `package.json`/`bun.lockb` a la versión previa (react-day-picker 8, zod 3), no bumpear `APP_VERSION`, dejar notas en `CHANGELOG.md`.
