## Problema

En el tab **Tracking** del detalle de embarques (ELIMP00297), aparecen dos avisos incorrectos cuando el embarque **ya tiene `fecha_llegada_real` capturada**:

1. **Card "ETA vencida"** — se muestra aunque el embarque ya arribó.
2. **Badge "Requiere actualización"** junto a "Último evento hace 10 días — Arribo a Puerto" — se marca como crítico aunque el arribo ya ocurrió y no hay más movimientos que esperar.

## Causa

En `src/features/embarques/components/TabTracking.tsx`:

- `isEtaVencida()` sólo descarta los estados `Entregado` y `Cerrado`, pero **no** el caso donde `fecha_llegada_real` está capturada (el embarque ya llegó a puerto/aeropuerto aunque siga En Tránsito administrativamente).
- `computeFreshness()` marca `critical: true` si el último evento tiene ≥ 7 días, sin importar que ese último evento sea precisamente el **arribo** (fin del flujo de tracking operativo).

## Solución (frontend puro, sin cambios de negocio)

**Archivo:** `src/features/embarques/components/TabTracking.tsx`

1. **`isEtaVencida`**: retornar `false` cuando `embarque.fecha_llegada_real` está definido (además de los estados `Entregado`/`Cerrado`).

2. **`computeFreshness`**: recibir un flag `arribado` (derivado de `fecha_llegada_real != null` o estado `Entregado`/`Cerrado`). Cuando `arribado === true`:
   - No marcar `critical`.
   - No calcular `etaProxima`.
   - Cambiar el label a algo como `"Arribado — <tipo del último evento>"` para que el usuario entienda que el tracking cerró.

3. Pasar el flag desde el render principal usando el `embarque` ya disponible.

## Verificación

- Recargar el detalle del embarque 297 (que tiene `fecha_llegada_real`): no debe aparecer la card roja "ETA vencida" ni el badge amarillo "Requiere actualización".
- Un embarque **En Tránsito sin** `fecha_llegada_real` y con ETA pasada debe seguir mostrando ambos avisos.
- Typecheck + tests de `TabTracking` si existen.

## Entregables

- Edición del archivo mencionado.
- Bump de `APP_VERSION` (patch) y entrada en `CHANGELOG.md` describiendo el fix.
