## Respuesta corta

**No.** Hoy el portal del cliente **no muestra** si una cotización aceptada ya se convirtió en embarque. Verifiqué la base de datos:

- La tabla `embarques` tiene la columna `cotizacion_id` (vínculo correcto), pero solo **1 de 206 embarques** la tiene poblada.
- La columna espejo `cotizaciones.embarque_id` existe pero está vacía en todas las cotizaciones aceptadas (COT-2026-0055, 0054, 0047, 0032, etc.).
- Ni `PortalCotizaciones.tsx` ni `PortalCotizacionDetalle.tsx` consultan ese vínculo.

Resultado: el cliente acepta una cotización y se queda "a ciegas" — no sabe si su carga ya está en operación ni puede saltar al embarque.

---

## Plan propuesto (v8.99.4)

### 1. Backfill + garantizar el vínculo en backend

Migración SQL que:
- **Backfill**: para cada cotización con `estado IN ('Aceptada')` que aún no tenga embarque, busca un embarque cuyo `cotizacion_id` la apunte y rellena `cotizaciones.embarque_id` con ese valor.
- **Trigger** `AFTER INSERT/UPDATE` en `embarques`: cuando se crea/actualiza un embarque con `cotizacion_id` no nulo, sincroniza automáticamente `cotizaciones.embarque_id`. Así nunca más quedan desincronizados.
- Revisar la función de conversión cotización→embarque (`services/cotizacion/conversiones/embarques.ts`) para que también escriba `cotizaciones.embarque_id` al crear el embarque (defensa en profundidad junto al trigger).

### 2. Exponer el dato al portal

- Ampliar `fetchPortalCotizaciones` y `fetchPortalCotizacionDetalle` para incluir `embarque_id` y, vía join, el `expediente` del embarque relacionado.
- Como las RLS del portal ya permiten al cliente leer sus propios embarques, no hace falta cambiar políticas.

### 3. UI en el portal

**Listado `/portal/cotizaciones`**:
- Para cotizaciones `Aceptada` con embarque vinculado: badge verde "Embarque creado · EXP-XXXX" junto al folio.
- Sin embarque aún: badge ámbar "Pendiente de operación".

**Detalle `/portal/cotizaciones/:id`** (en `PortalCotizacionEstadoBanner`):
- Si `Aceptada` + tiene embarque: banner verde con texto "Esta cotización ya está en operación" y botón **"Ver embarque EXP-XXXX →"** que navega a `/portal/embarques/:embarqueId`.
- Si `Aceptada` sin embarque: mensaje informativo "Tu cotización fue aceptada. Te notificaremos cuando inicie la operación."

### 4. Changelog

Entrada **v8.99.4** en `src/content/changelog/v8/chunks/0.ts`:
> Trazabilidad cotización → embarque en el portal del cliente. Las cotizaciones aceptadas ahora muestran si ya están en operación e incluyen acceso directo al embarque vinculado.

---

## Archivos a tocar

- `supabase/migrations/<nuevo>.sql` (backfill + trigger)
- `src/services/cotizacion/conversiones/embarques.ts` (escribir embarque_id de vuelta)
- `src/services/portal/queries.ts` + `columns.ts` (incluir vínculo)
- `src/pages/portal/PortalCotizaciones.tsx` (badge en listado)
- `src/components/portal/cotizacion/PortalCotizacionEstadoBanner.tsx` (banner + botón)
- `src/content/changelog/v8/chunks/0.ts`

¿Procedo con esta implementación?
