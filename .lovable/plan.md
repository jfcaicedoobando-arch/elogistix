## Objetivo

Dejar la suite en verde. Hoy fallan 12 archivos por tres causas distintas (ninguna es culpa del paralelismo que ya aplicamos).

## Diagnóstico confirmado

| # | Archivo | Causa real (verificada al correr los tests) |
|---|---|---|
| 1 | `src/features/tesoreria/routes/__tests__/TesoreriaConciliacion.test.tsx` (6 tests) | El `vi.mock` de `@/features/tesoreria/hooks` no exporta `useRegistrarMovimientoManual`, hook que la ruta empezó a usar al agregar el alta manual en Conciliación. El mock quedó viejo. |
| 2 | `src/features/cotizacion/hooks/wizard/__tests__/useCotizacionDraftAutosave.test.tsx` (2 tests) | El test asume que **nada** se guarda antes del debounce, pero el hook ahora persiste una vez en el montaje. El test quedó viejo respecto al comportamiento nuevo. |
| 3 | `src/__tests__/audit-report.test.ts`, `architecture/no-inline-query-mutations.test.ts`, `architecture/safe-cast-freshness.test.ts`, `architecture/safe-casts-services.test.ts` (7 tests) | Deuda real de arquitectura acumulada en las olas 2–5: 10 archivos productivos >200 líneas fuera de allowlist, 2 hooks `use*.ts(x)` dentro de `components/`, 1 cast HIGH sin marcador y entradas de baseline SAFE-CAST caducadas. |

Analogía: (1) y (2) son "la lista de invitados quedó vieja"; (3) es "sí hay platos sucios en la cocina".

## Plan

**Fase 1 — Mocks y timers (rápido, sin tocar producción)**
- Agregar `useRegistrarMovimientoManual` (y cualquier otro export faltante) al mock del test de Conciliación, devolviendo el mismo shape de mutación que los demás.
- Ajustar el test de autosave al contrato actual: en vez de exigir `null` antes del debounce, verificar que tras el debounce se escribió el snapshot esperado y que el unmount cancela el timer pendiente (sin escrituras extra). Antes de cambiar el test, confirmar en el hook que el guardado inicial es intencional; si no lo es, se corrige el hook en lugar del test.

**Fase 2 — Deuda de arquitectura (la de verdad)**
- Listar los 10 archivos >200 líneas y partirlos por responsabilidad (extraer subcomponentes/hook de estado), siguiendo la regla Power of 10. Los que no sean divisibles con seguridad se documentan y se agregan a la allowlist con justificación.
- Mover los 2 hooks que viven bajo `components/` a la carpeta `hooks/` de su feature y actualizar imports.
- Resolver el cast HIGH: tipar correctamente o, si es genuinamente seguro, anotarlo con `// SAFE-CAST:`.
- Podar de la baseline de `safe-cast-freshness` las entradas ya resueltas (la baseline solo puede encoger).

**Fase 3 — Verificación**
- Correr los 12 archivos afectados, después la suite completa con el paralelismo nuevo (~10 min) y confirmar 0 fallos.
- Correr `bun run lint --max-warnings 0` y el typecheck, porque partir archivos suele destapar imports huérfanos.

**Fase 4 — Cierre**
- Registrar en `CHANGELOG.md` tanto el paralelismo de Vitest (que quedó pendiente) como estas correcciones, y subir `APP_VERSION` a `13.342.0`.

## Notas técnicas

- No se toca `vitest.config.ts`: el paralelismo ya quedó bien y los mismos 12 fallos existían en serie.
- CI no cambia; sigue con su propio sharding.
- Fase 2 es la única que modifica código productivo; el riesgo está en los imports tras mover/partir archivos, por eso el typecheck va inmediatamente después.
