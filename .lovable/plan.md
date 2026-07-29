## Qué encontré en Sentry (15 issues abiertos, últimas ~2 h)

Los revisé uno por uno. Se agrupan en 4 categorías:

### A. Ruido de infraestructura (77 de ~98 eventos) — no son bugs de la app
`JAVASCRIPT-REACT-3P / 3N / 3Z / 3R` ("pt", "Error: <!doctype html>"). El contenido del error es una página **Cloudflare Tunnel error 1033** del túnel de pruebas `*.trycloudflare.com`. Es decir: se cayó el túnel de la demo y cada consulta recibió HTML en vez de JSON. Analogía: el cartero devolvió un cartel de "calle cerrada" y lo guardamos como si fuera una carta.
- **Acción:** filtrar en el `beforeSend` de Sentry los errores cuyo mensaje empiece con `<!doctype html` / `<html` o provengan de host de túnel, y mostrar al usuario "Sin conexión con el servidor" en vez de reportarlos.

### B. Bugs reales confirmados
1. **`3S` / `3T` — RLS al crear cuenta bancaria** (`/tesoreria/cuentas`, rol `tesorero`, pg 42501). Verificado en la base: `cuentas_bancarias` sólo tiene política de **lectura** para `tesorero`/`contador`; la escritura exige `admin`. El botón "Nueva cuenta" sí se le muestra al tesorero. Hay dos salidas posibles (ver pregunta abajo).
2. **`3Q` — `PGRST200: Could not find a relationship between 'facturas' and 'proformas'`** en el detalle de factura. Verificado: la llave foránea `facturas_proforma_id_fkey` **sí existe** en la base; lo que falló fue el **caché de esquema** de la API tras una migración. Analogía: el índice del directorio quedó viejo y no encontró un teléfono que sí está.
   - Acción: recargar el caché de esquema y hacer que las migraciones lo recarguen al final, más un reintento tolerante en `src/features/facturacion/services/detail.ts`.
3. **`3M` — "user-management: correos sin resolver"** en `/usuarios`. Esta alerta es intencional (banner P-09), pero indica que la función `user-management` está devolviendo usuarios sin correo. Acción: revisar sus logs y corregir la resolución de correos; hoy sólo se reporta el síntoma.
4. **`3W` — 404 en `/sistema/bitacora`**. La ruta real es `/bitacora`. Acción: agregar redirección `/sistema/bitacora → /bitacora` y bajar el 404 de `error` a `warning` en Sentry.

### C. Ya corregidos en 13.336.0–13.337.0, pendientes de publicar
`41` (Embarque cerrado: usa reabrir_embarque), `42` ([object Object] al reabrir), `40` (Embarque cerrado: edición bloqueada en conceptos_venta). Los eventos vienen de las versiones **13.334.x**, anteriores al fix. Acción: marcarlos como resueltos en Sentry y publicar.

### D. Reglas de negocio mostradas como error (no deberían ir a Sentry)
`3V` "Captura los conceptos de la factura antes de aprobar", `3X`, `3Y`. Son validaciones esperadas. Acción: clasificarlas como advertencia de usuario y no reportarlas como excepción.

## Mejora transversal
Varios eventos llegan como *"Object captured as exception with keys: code, details, hint, message"*: se está mandando el error crudo de la base a Sentry. Normalizarlo a un `Error` con el mensaje y el `pg_code` como etiqueta mejora el agrupamiento y evita títulos inútiles como "M" o "pt".

## Detalles técnicos
- Filtro en `beforeSend` (`src/lib/monitoring/*`): descartar `PGRST`/HTML de túnel, `Failed to fetch` sin red, y errores de negocio marcados con `businessRule: true`.
- Normalizador de `PostgrestError` → `Error(message, { cause })` + tags `pg_code`, `pg_details`.
- Migración: `NOTIFY pgrst, 'reload schema'` y, si se decide, política de escritura para `tesorero` en `cuentas_bancarias`.
- Redirección de ruta en `src/routes/appRoutes.tsx`.
- Actualizar `CHANGELOG.md` y `APP_VERSION`, y cerrar en Sentry los issues corregidos.

## Pregunta antes de ejecutar
En **cuentas bancarias**: ¿el rol *tesorero* debe poder crear/editar cuentas (abro la política en la base), o sólo consultarlas (entonces oculto el botón "Nueva cuenta" y muestro un mensaje de permisos)? Si no me indicas, tomo la opción segura: **sólo consulta**, ocultando el botón.
