# El botón "Volver a Facturas de proveedor" a veces no hace nada

## Qué encontré

Reproduje el clic en la app real (con sesión) de dos formas y en ambas funcionó:

- Entrando directo por URL al detalle → el botón lleva a `/compras/facturas`.
- Entrando desde el listado y haciendo clic en un renglón → el botón regresa al listado.

Así que el botón no está "muerto" siempre: falla sólo en ciertos caminos de llegada. La causa aún no está confirmada, y el plan la verifica antes de tocar la lógica.

Por qué puede quedarse quieto: el botón no es un enlace fijo, usa `useVolver`, que decide en el momento del clic:

1. Si la navegación traía una ruta de origen explícita, va a esa ruta.
2. Si detecta historial interno, hace "atrás" del navegador.
3. Si no, va a `/compras/facturas`.

El caso 2 es el frágil: si la entrada anterior del historial es la **misma** página (por ejemplo se llegó tras una acción que reemplazó la URL, o desde un flujo que rebota hacia adelante), el "atrás" ocurre pero la pantalla no cambia — se siente como si el botón no hiciera nada.

Analogía: el botón no tiene una dirección escrita; dice "regrésame por donde vine". Si el paso anterior era este mismo cuarto, das el paso y sigues en el mismo cuarto.

Nota: si el clic se probó con el selector de elementos del preview activo, ese modo captura los clics y ninguna acción se ejecuta. Vale la pena descartarlo con un clic normal.

## Qué voy a hacer

1. **Confirmar el caso real**: reproducir la llegada al detalle por los otros caminos (desde el expediente del embarque, desde el buzón de facturas recibidas, después de capturar/aprobar una factura) y registrar en cuál el "atrás" deja la misma URL.

2. **Hacer el botón a prueba de balas**: `useVolver` intentará el "atrás" y, si al instante siguiente la ruta no cambió, navegará a la ruta de respaldo (`/compras/facturas`). Un clic siempre produce un cambio visible.

3. **Que se comporte como enlace**: el botón Volver del encabezado de detalle mostrará la ruta de respaldo como `href`, para que se pueda abrir en pestaña nueva o con clic central, sin perder el comportamiento inteligente en el clic normal.

4. **Pruebas**: casos unitarios de `useVolver` para "atrás no cambió la ruta → usa respaldo", más el caso con ruta de origen explícita y el de llegada directa.

5. **Registro**: subir `APP_VERSION` y anotar el cambio en `CHANGELOG.md`.

## Detalles técnicos

- `src/hooks/shared/useVolver.ts`: tras `navigate(-1)`, comparar `window.location.pathname + search` en un `setTimeout(0)` / `requestAnimationFrame` contra el valor previo; si es igual, `navigate(fallback, { replace: true })`. Devolver también el `fallback` para que el consumidor pueda pintar un `href`.
- `src/components/shared/DetailHeader.tsx`: cuando `backTo` es función con `fallback` conocido, renderizar `<Link to={fallback}>` con `onClick` que haga `preventDefault()` + la lógica de volver (conservando clic central / Cmd+clic nativos).
- `src/features/cxp/components/detalle/FacturaProveedorHeader.tsx`: sin cambios de API, sólo consumir la nueva forma de `useVolver`.
- Tests nuevos en `src/hooks/shared/__tests__/useVolver.test.tsx` con `MemoryRouter` y reloj falso.
