# Fix: Unhandled promise rejection al crear ruta duplicada

## Problema

En `/costeo/rutas`, al intentar guardar una ruta CN→MX duplicada, Sentry registra un `UnhandledRejection` con el error crudo de Postgrest (`{code, details, hint, message}`). La respuesta HTTP es 409 (violación de unique constraint), pero el rechazo termina como promesa no manejada.

Dos causas combinadas:

1. **`RutaFormDialog.handleGuardar`** llama `await crear.mutateAsync(...)` sin `try/catch`. React Query dispara `onError` (toast), pero `mutateAsync` **igualmente** rechaza la promesa. Como `handleGuardar` es un handler `onSubmit` no esperado por nadie, el rechazo queda colgado → `unhandledrejection`.
2. **`insertCosteoRuta`** detecta el unique violation comparando contra el nombre exacto `costeo_rutas_organization_id_puerto_origen_id_puer` (truncado). Si en producción el nombre del constraint difiere, `isUniqueViolation` devuelve `false` y se relanza el objeto crudo (no `Error`) — que es justo lo que Sentry capturó. El check por `code === "23505"` debería bastar, pero por las dudas reforzamos.

## Cambios

### 1. `src/features/costeo/components/RutaFormDialog.tsx`
Envolver `crear.mutateAsync` en `try/catch` para consumir el rechazo. El toast ya lo emite `onError` del hook; aquí sólo evitamos cerrar el diálogo y resetear el formulario cuando falla.

```ts
try {
  await crear.mutateAsync({ ... });
  setOrigenId(""); setDestinoId(""); setIntentoEnvio(false);
  onOpenChange(false);
} catch {
  // onError del hook ya mostró el toast; mantenemos el diálogo abierto.
}
```

### 2. `src/features/costeo/services/rutas.ts`
Endurecer `isUniqueViolation`: aceptar también `code === 23505` (numérico), y match más laxo del nombre de constraint (`/costeo_rutas.*puerto/i`). Garantiza que cualquier 409 por duplicado se traduzca a `CosteoRutaDuplicadaError` (que sí es `Error`), nunca al objeto Postgrest crudo.

### 3. Tests
Extender `rutas.test.ts` con un caso donde el constraint name viene distinto pero `code` es `"23505"` — debe lanzar `CosteoRutaDuplicadaError`.

### 4. Versión / changelog
- `APP_VERSION` → `13.67.6`
- Entrada en `CHANGELOG.md` describiendo el fix.

## Fuera de alcance
- No se toca RLS, schema, ni la UI del módulo más allá del handler.
- No se cambian otros diálogos del feature (sólo `RutaFormDialog` mostró el síntoma); si quieres puedo auditar el resto de `mutateAsync` del módulo en un follow-up.
