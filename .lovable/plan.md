## Diagnóstico

La factura **F975** está en estado `Emitida`, ya tiene `sustituida_por = F991` (también `Emitida`, viva). El botón "Cancelar CFDI" desapareció porque en `src/features/facturacion/domain/facturaFlags.ts` (línea 91) `Cancelar` y `Sustituir` comparten la misma condición:

```ts
const puedeCambiarCfdi = timbradaVigente && canEdit && !isSustitutaViva(f);
// ...
puedeCancelarCfdi:  puedeCambiarCfdi,
puedeSustituirCfdi: puedeCambiarCfdi,
```

Cuando existe una sustituta viva, `isSustitutaViva = true` y ambos se apagan. Pero en el flujo SAT motivo **01 (sustitución)** el orden correcto es: **1º emitir la sustituta → 2º cancelar la original**. Es decir, tener sustituta viva es *precondición* para cancelar la original, no un bloqueo.

## Cambios

### 1. `src/features/facturacion/domain/facturaFlags.ts`
Separar las dos condiciones:

- `puedeSustituirCfdi = timbradaVigente && canEdit && !isSustitutaViva(f)` (sin cambio: no se sustituye dos veces).
- `puedeCancelarCfdi = timbradaVigente && canEdit && !estaCancelada && (cancellation_status !== 'pending')` (permitir cuando ya hay sustituta viva; bloquear si ya está en trámite de cancelación).

Ajustar tests de `facturaFlags.test.ts` si existen (agregar caso: factura Emitida con sustituta viva → `puedeCancelarCfdi: true, puedeSustituirCfdi: false`).

### 2. `DialogCancelarFactura` / `SelectorSustituta`
Verificar que cuando se abre desde una factura con `sustituida_por` ya establecido, el `SelectorSustituta` prellene esa sustituta y no permita elegir otra (motivo 01 debe amarrarse a la relación que ya existe en BD).

### 3. Limpiar estado stale de F975
`cancelacion_solicitada_en` tiene fecha pero `cancellation_status = 'none'` (residuo de un intento previo). No es lo que bloquea el botón, pero conviene ejecutar `facturapi-consultar` sobre F975 después del fix para reconciliar (o dejar que el usuario use "Limpiar estado local"). No requiere código, sólo verificación manual.

### 4. Versionado
- Bump `APP_VERSION` a `13.301.36`.
- Nueva entrada en `CHANGELOG.md`.

## Verificación

1. Recargar F975 → botón "Cancelar CFDI" visible en la barra de acciones.
2. Al abrir el diálogo, la sustituta F991 aparece preseleccionada.
3. F991 (la sustituta viva) sigue **sin** botón "Sustituir" ni "Cancelar" reutilizables incorrectos — sólo su propio flujo normal.
4. `bun run ci:fast` en verde.
