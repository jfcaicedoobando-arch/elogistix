# Fixes Ronda 7 — 8 correcciones (P1 → P3)

Estado verificado en el proyecto antes de planear (no supuestos):

- Las policies de `notificaciones_cliente` sí exigen `admin`/`operador`/`super_admin` (whitelist de roles). `ejecutivo_pricing`, contador y tesorero quedan fuera tanto para insertar como para leer. Confirmado en la base.
- La bitácora tiene 6,787 eventos, de los cuales **59** siguen con `organization_id` nulo (más de los 15 del reporte).
- `OrganizationContext` cae en `orgList[0]` cuando no hay org guardada; nunca usa `cachedOrgId`.
- `GlobalSearch` no pasa `shouldFilter={false}` al `CommandDialog` y no distingue error de "sin resultados".
- `/comisiones` en `roleRouteMatrix` permite admins, contador, tesorero y gerentes; el sidebar de coordinador logístico **no** incluye el ítem (revisado en `sidebarRoleBuilders`), así que el punto 7 requiere confirmación antes de cambiar código.
- `NotificacionesPopover` y `ThemeToggle` ya tienen `aria-label`; el punto 8 se reduce a refresh y kebab "…".
- Etiquetas de IVA en `SeccionConceptosVentaCotizacion` usan la tasa de la organización (`tasaPct`) en 4 lugares.

## P1

1. **Notificaciones al cliente (DIFF 1).** Migración que reescribe las policies de INSERT y SELECT de `notificaciones_cliente` por **membresía de organización** (mismo criterio que el resto de tablas tenant), más un trigger `SECURITY DEFINER` en `cotizaciones` que inserta la notificación al pasar a "Enviada". El envío desde el front queda como respaldo idempotente (sin duplicar: el trigger es la fuente de verdad y el front deja de insertar).

2. **Bitácora sin organización (DIFF 4).** Migración de backfill en 3 pasos: membresía del autor → organización de la entidad relacionada (embarque/cotización) → organización dominante como último recurso, para las 59 filas nulas. Sin tocar el aislamiento por org de las policies.

3. **Buscador global ⌘K (DIFF 5).** Desactivar el filtrado en cliente (`shouldFilter={false}`) para que los resultados del servidor no se vuelvan a filtrar, y agregar estado de error visible ("Error al buscar · Reintentar") distinto del vacío.

## P2

4. **Org de aterrizaje del super admin (DIFF 3).** En `OrganizationContext`, preferir `cachedOrgId` (resultado de `default_user_org_id`) antes de caer en la primera organización alfabética; agregar `cachedOrgId` a las dependencias del efecto.

5. **Etiqueta de IVA por tasa efectiva (DIFF 2).** Derivar la etiqueta de las tasas reales de los conceptos: una sola tasa → `IVA (8%)`; varias → `tasas mixtas 8/16%`; sin IVA → tasa de la organización. Aplicar en el resumen MXN, el resumen USD y los dos pies de nota, y propagar la etiqueta a `ResumenTotalesCotizacion` para que portal y PDF impriman lo mismo.

6. **Detalle de embarque sin timeout (DIFF 6).** Añadir un temporizador de 20 s mientras carga; al vencer, mostrar `ErrorStateInline` con botón Reintentar que reinicia el temporizador y vuelve a consultar.

7. **Menú "Comisiones" (DIFF 7).** Pendiente de confirmar el rol exacto: en el código actual el ítem aparece para admins, contador, tesorero y gerentes, que sí tienen acceso a la ruta. Primer paso será reproducir con el rol reportado y, si el ítem se filtra correctamente, dejarlo sin cambios y anotarlo; si aparece para un rol sin acceso, alinear la lista del sidebar con `COMISIONES_ROLES`.

## P3

8. **Accesibilidad de iconos (DIFF 8).** Agregar `aria-label` + `title` a los botones que aún no lo tienen: refresh de la barra superior y kebab "…" del detalle de embarque ("Más acciones"). Campana y tema ya cumplen.

## Verificación

- Consultas de comprobación tras las migraciones: 0 filas con `organization_id` nulo en bitácora; policies de `notificaciones_cliente` listadas por membresía; una cotización pasada a "Enviada" genera su notificación.
- Pruebas unitarias nuevas para la etiqueta de tasas (una tasa, mixta, sin IVA) y para el helper de timeout de carga.
- Revisión visual con Playwright a 1920x1080 del buscador (resultado y error) y del detalle de embarque en timeout.
- Registro en `CHANGELOG.md` y bump de `APP_VERSION`.

## Notas técnicas

- Migraciones nuevas: policies de `notificaciones_cliente` + trigger `trg_notificar_cotizacion_enviada`, y backfill de `bitacora_actividad`. Se respetan `GRANT`s existentes; no se crean tablas.
- Archivos a tocar en front: `src/components/shared/GlobalSearch.tsx`, `src/components/ui/command.tsx` (si `CommandDialog` no acepta `shouldFilter`), `src/lib/contexts/OrganizationContext.tsx`, `src/features/cotizacion/components/SeccionConceptosVentaCotizacion.tsx` y `ResumenTotalesCotizacion.tsx`, `src/features/embarques/routes/EmbarqueDetalle.tsx`, y los componentes de la barra superior/detalle para accesibilidad.
- Cada archivo se mantiene bajo el límite de 200 líneas; la lógica de etiqueta de tasas y el timeout se extraen a helpers/hooks propios con pruebas.
