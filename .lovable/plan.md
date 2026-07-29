## Qué pasó

Verifiqué el embarque `ELIMP00351` en la base: hoy tiene `tipo_cambio_usd` y `tipo_cambio_eur` en blanco (NULL), y la restricción es `CHECK (tipo_cambio_eur > 0)`. El guardado intentó escribir `0`, y la base lo rechazó.

Analogía: el formulario dejó la casilla "pesos por euro" vacía, pero el traductor entregó "cero pesos por euro" — un dato imposible, y el archivero lo rechazó.

Ese traductor **ya está arreglado en el código actual** (`embarqueToDb.ts` usa `tcOrNull`, que manda "no aplica" cuando el campo va vacío). El arreglo salió en la versión **13.320.18**, pero el reporte de error viene de la versión **13.320.14**: Valeria está usando una versión publicada más vieja que el arreglo. Hoy el código del proyecto va en 13.334.5.

## Plan

1. **Republicar la app** (causa real). Sin republicar, los usuarios siguen con el bundle viejo que manda `0`.
2. **Blindaje en la base de datos** (para que nunca vuelva a depender del navegador): actualizar el RPC `actualizar_embarque_completo` y los dos overloads de `crear_embarque_completo` para que un `0` o cadena vacía en `tipo_cambio_usd` / `tipo_cambio_eur` se trate como "sin dato" (`NULLIF(valor, 0)`) en lugar de intentar guardarse.
3. **Test de regresión**: caso en `embarqueToDb.test.ts` (si no existe ya) y una prueba SQL corta que confirme que guardar con TC `0` deja el campo vacío en vez de reventar.
4. **CHANGELOG + bump de `APP_VERSION`** siguiendo el formato del proyecto.

## Detalle técnico

- Constraints confirmados: `embarques_tc_usd_pos`, `embarques_tc_eur_pos` → `> 0`, ambas columnas nullable.
- Único punto del frontend que escribe estos campos: `src/features/embarques/domain/mappers/embarqueToDb.ts` → `partesFinancieras`. Ya sanea vía `tcOrNull`.
- Migración: redeploy de las funciones con `NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0)`, conservando `SECURITY DEFINER` + `REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO authenticated` para no romper la regla H6 de `audit:migrations`.
