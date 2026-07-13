## Diagnóstico

En el wizard `/cotizaciones/nueva` el sidebar de progreso (`Paso1ProgressSidebar`) toma el estado de la sección Mercancía de `usePaso1SectionStatus.ts:65,76-78`:

```ts
mercancia: !!tipoCarga && ((pesoKg ?? 0) > 0 || (piezas ?? 0) > 0)
```

Sólo revisa los campos "planos" `pesoKg` y `piezas`, pero cada modo captura la mercancía en un lugar distinto:

| Modo | Componente | ¿Escribe `pesoKg`/`piezas`? |
|---|---|---|
| Terrestre | `SeccionMercanciaGeneral` | ✅ sí |
| Aéreo | `SeccionMercanciaAerea` | ❌ guarda en `dimensionesAereas[]` |
| Marítimo LCL | `SeccionMercanciaMaritimaLCL` | ❌ guarda en `dimensionesLCL[]` |
| Marítimo FCL | `SeccionMercanciaMaritimaFCL` | ❌ sólo `tipoContenedor` / `tipoPeso` |

Resultado: en Aéreo, FCL y LCL el check verde de Mercancía nunca prende aunque el usuario haya llenado toda la carta.

**Analogía:** el sidebar preguntaba "¿ya pesaste el bulto?" mirando una báscula (los campos planos `pesoKg`/`piezas`) que sólo se usa en modo terrestre. En aéreo/marítimo la mercancía se pesa por filas de dimensiones o por contenedor, así que el sensor miraba una báscula vacía y siempre reportaba "aún no".

## Cambios

**Un solo archivo:** `src/features/cotizacion/hooks/usePaso1SectionStatus.ts`

1. Ampliar el `useWatch` para incluir los campos por modo:
   - `dimensionesAereas` (para Aéreo)
   - `dimensionesLCL` (para Marítimo LCL)
   - `tipoContenedor`, `numContenedores` (para Marítimo FCL)
2. Reescribir `mercanciaOk` como función mode-aware:
   - **Terrestre / default:** requiere `tipoCarga` + (`pesoKg>0` ∨ `piezas>0`) — comportamiento actual.
   - **Aéreo:** requiere `tipoCarga` + al menos una fila en `dimensionesAereas` con `piezas>0` y `pesoKg>0`.
   - **Marítimo LCL:** requiere `tipoCarga` + al menos una fila en `dimensionesLCL` con `piezas>0` y (`pesoKg>0` ∨ dims válidas).
   - **Marítimo FCL:** requiere `tipoCarga` + `tipoContenedor` no vacío + `numContenedores>0`.
3. Determinar el modo por `modo` (ya está en `useWatch`) y `tipo_servicio`/inferencia FCL vs LCL — reutilizar la misma bandera `esMaritimo` y agregar detección FCL/LCL vía el campo existente (revisar cuál usa el form; probablemente `tipoServicio` o presencia de `tipoContenedor`). Si no hay campo explícito, tratar como FCL cuando existe `tipoContenedor` y como LCL cuando existe cualquier fila de `dimensionesLCL`.

Sin cambios en UI, tipos exportados, ni tests. La firma pública de `usePaso1SectionStatus` no cambia.

## Verificación

- `tsgo --noEmit` para tipos.
- Recorrido manual en `/cotizaciones/nueva`:
  - Aéreo con 1 fila de dimensiones llenas → Mercancía verde.
  - Marítimo FCL con `tipoContenedor` y `numContenedores≥1` → Mercancía verde.
  - Marítimo LCL con 1 fila LCL llena → Mercancía verde.
  - Terrestre con `pesoKg` o `piezas` → sigue verde (regresión).

## Versionado

Bump `APP_VERSION` a `13.298.3` + entrada en `CHANGELOG.md` (bugfix wizard cotización).
