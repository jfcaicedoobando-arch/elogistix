# Ronda 3 — verificación y cierre de pendientes

Verifiqué el documento contra el código actual (v13.352.0). Buena parte ya quedó cerrada en la ola anterior; abajo va lo confirmado y lo que falta.

## Ya resuelto y verificado en código

| Ítem | Estado |
|---|---|
| R-01 Corrupción Cant/Costo/Venta | Clamp de 9,999 eliminado y edición con buffer local (`useNumericField`) en las tres celdas |
| R-02 Cotización "Solicitada" sin acción | Acción "Completar cotización" en el detalle |
| R-03 Alta de proveedor / ruta de costeo | Whitelist de columnas, validación categoría↔tipo y error real en el toast |
| R-04 Catálogo SAT vs ventas | Se ocultó el CTA para roles comerciales (decisión de producto ya tomada) |
| R-06 Empty-state falso | Ya no aparece durante la carga y hay banner "Reintentar" |
| R-07 HTML crudo en toasts | `sanitizeToastText` aplicado en todas las notificaciones |
| R-09 Restaurar borrador | Pausa del autoguardado durante la restauración, con tests |
| R-11 /embarques para ventas | Acceso de sólo lectura documentado en la matriz de roles |
| R-12.1 Deep link tras login | El login ya respeta la ruta original (`from`) |
| R-14 "R3" → "R" | `toTitleCase` corregido |

## Pendiente (lo que propongo hacer ahora)

### 1. R-05 · Nada debe quedar cargando para siempre
- Aplicar el patrón de "15 s → mensaje con Reintentar" a las pantallas que hoy no lo tienen: embarques, nueva cotización, nueva factura de compra, pagos programados y las dos del portal del cliente.
- Cuando el usuario no tiene permiso para una pantalla (p. ej. tesorero en "nueva factura de compra"), mostrar el aviso de permiso antes de intentar cargar datos, en vez de dejar el esqueleto girando.
- Detalle inexistente (cotización en app y portal): mostrar "Cotización no encontrada".

### 2. R-08 · Bloquear envío de cotizaciones en $0
- Deshabilitar el botón "Enviar por correo" del encabezado cuando no hay importes de venta, con tooltip explicativo (hoy sólo hay un aviso de texto más abajo).
- Añadir la misma validación en la base de datos como red de seguridad.

### 3. R-10 · Alta de navieras desde su propia pantalla
- Botón "Nueva naviera" en /costeo/navieras (y en el estado vacío), reutilizando el modal rápido que ya existe en el formulario de tarifas.
- Verificar/crear el permiso de alta en la base para coordinador logístico y administradores.

### 4. R-12.2 · Sin parpadeo de menú lateral
- No dibujar el layout hasta que el guard resuelva permisos.

### 5. R-13 · Plurales y microcopy
- Usar el helper `pluralizar` en los contadores ("1 cotización", "1 cliente", "7 usuarios", "1 factura seleccionada").
- Etiquetas de rol legibles en la barra lateral ("Ejecutivo pricing" en vez de "Ejecutivo_pricing"), reutilizando el catálogo de roles existente.
- Títulos de pestaña en /inicio y /cotizaciones, y que el título se actualice tras iniciar sesión.

### 6. R-15 · UX miscelánea
- Confirmación al cerrar "Nuevo cliente" con cambios sin guardar.
- Campo "Días de crédito" del modal de agente: mismo arreglo de captura que R-01 (hoy muestra "030").
- Exportar PDF sin movimientos: avisar en vez de no hacer nada.
- /admin/diagnostico: estados vacíos en lugar de esqueletos perpetuos.
- Toast "Ver detalles": corregir el solape con el selector de organización.
- Copy de error distinto para lecturas y para acciones.

### 7. Pruebas
- Unitarias: pluralización, etiquetas de rol, bloqueo de envío en $0, timeout con Reintentar, alta de naviera.
- E2E: alta de proveedor nacional y extranjero, y restaurar borrador del wizard (paso + cliente + fila de costos), que son los dos casos del checklist sin cobertura automatizada.

## Notas técnicas
- El helper de plural ya existe en `src/lib/format/pluralizar.ts`; no se crea uno nuevo en `formatters.ts`.
- `LoadingState` (en `src/components/shared/states/`) ya soporta `timeoutMs`/`onRetry`: sólo falta extender su uso (hoy 12 archivos).
- `computeRoleLabel` en `AppSidebar.tsx` capitaliza a mano; se sustituye por `obtenerEtiquetaRol` del catálogo de roles.
- R-16 es re-test, no cambio de código: queda para la ronda 4 una vez publicado esto.
- Cierre con bump de `APP_VERSION` a 13.353.0 y entrada en `CHANGELOG.md`.
