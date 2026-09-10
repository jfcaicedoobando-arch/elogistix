# Cerrar embarque: mensaje de error cuando el embarque ya se cerró solo

## Qué pasó (verificado)

El expediente **ELIMP00245** ya estaba cerrado cuando presionaste el botón:

- El sistema lo cerró automáticamente a las 22:36:28 con el motivo "Cierre automático: se liquidó el último saldo por cobrar y por pagar".
- Tu clic ocurrió a las 22:36:59, 31 segundos después.
- El servidor respondió correctamente "El embarque ya está cerrado", pero la pantalla lo mostró como un error rojo, como si algo hubiera fallado.

No hay datos dañados: el cierre quedó bien registrado, con su historial, su comisión marcada como definitiva y sus totales.

La causa es sólo de pantalla: la pestaña de cierre guarda la información unos segundos y no se enteró del cierre automático, así que siguió mostrando el botón habilitado.

## Qué se va a corregir

1. Cuando el servidor responda que el embarque ya está cerrado, dejar de mostrarlo como error. En su lugar, mostrar un aviso tranquilo: "Este embarque ya se cerró" y refrescar la pantalla para que aparezca el candado y el historial.
2. Refrescar el estado del embarque al abrir la pestaña de cierre, de modo que un cierre automático reciente se refleje sin recargar la página.

## Lo que no se toca

Importes, comisiones, facturas, pagos, permisos, reglas de cierre, base de datos ni el cierre automático. Es un cambio de presentación.

## Detalle técnico

- `src/features/embarques/services/cierre.ts`: `cerrarEmbarque` devuelve `{ yaCerrado: true }` cuando el mensaje de la RPC es `El embarque ya está cerrado`, en lugar de lanzar `Error`.
- `src/features/embarques/hooks/useCierreEmbarque.ts`: `useCerrarEmbarque` distingue ese caso en `onSuccess`, invalida las queries con `invalidarTodo` y emite `notifyWarning` con título "Este embarque ya se cerró". El resto de errores mantiene `notifyError` y el método `FEATURES_EMBARQUES_HOOKS_USECIERREEMBARQUE_1`.
- `useValidacionCierre`: bajar `staleTime` y `refetchOnMount: "always"` para que la pestaña revalide al entrar.
- Prueba focalizada nueva del servicio/hook para el caso "ya cerrado" (aviso, no error).
- Cierre: `CHANGELOG.md` + `APP_VERSION` a `13.823.292`.

## Validación local

typecheck, ESLint focalizado, pruebas focalizadas de cierre y build. CI, RLS y E2E completos quedan para GitHub Actions.
