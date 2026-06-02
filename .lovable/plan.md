# Opción 4 — Tracking manual asistido

Mantener el tracking 100% manual (sin scraping ni APIs), pero darle al operador todas las herramientas para que actualizar el estado tome ~30 segundos por embarque.

## 1. Botones de acción rápida en el tab Tracking

En `TabTracking.tsx`, agregar una tarjeta "Consultar en la naviera" arriba del timeline (sólo si modo = Marítimo y existe `naviera` + `bl_master`):

- **Botón "Abrir tracking de {Naviera}"** → abre `window.open(url, "_blank", "noopener")` con la URL de tracking de esa naviera (catálogo nuevo, ver §3).
- **Botón "Copiar BL Master"** → `navigator.clipboard.writeText(embarque.bl_master)` + toast "BL copiado: ABCD1234567". Si no hay BL, deshabilitado con tooltip "Captura primero el BL Master en Resumen".
- **Hint inline**: "Pega el BL en la página, copia el último evento y regrésate a registrarlo abajo ↓".
- Si falta la naviera o el BL, mostrar alert sutil indicando qué capturar primero.

Para aéreo análogo: usar `aerolinea` + `mawb` (la mayoría de aerolíneas tienen tracking por AWB en su web).

## 2. Form "Registrar Evento" optimizado para el flujo

Modificar `TrackingNuevoEventoForm.tsx`:

- Después de guardar el evento, si el tipo es `Arribo a Puerto` o `Entrega`, **abrir un mini-prompt** "¿Actualizar fecha de llegada real (ETA real) del embarque a esta fecha?" → si acepta, hace `update embarques set fecha_llegada_real = fecha`.
- Si el tipo implica cambio de estado lógico (Zarpe→En Tránsito, Arribo→Arribo, Despacho Aduanal→En Aduana, Entrega→Entregado), ofrecer al guardar "¿Avanzar estado del embarque a {X}?".
- Pre-seleccionar tipo de evento sugerido según el estado actual del embarque (ej. si estado = "En Tránsito", default = "Arribo a Puerto").

## 3. Catálogo de URLs de tracking por naviera

Agregar columna `tracking_url_template TEXT` a `public.navieras` con placeholder `{BL}`. Ej:

- COSU: `https://elines.coscoshipping.com/ebusiness/cargoTracking?billNo={BL}`
- MAEU: `https://www.maersk.com/tracking/{BL}`
- MSCU: `https://www.msc.com/track-a-shipment?agencyPath=mscu&searchNumber={BL}`
- HLCU: `https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html?blno={BL}`
- ONEY: `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?ref={BL}`
- CMDU: `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=BL&Reference={BL}`

Una migración SQL (ALTER + UPDATE) llena los templates iniciales para las navieras existentes. Las que no tengan template muestran sólo el botón "Copiar BL" y un texto "Sin URL configurada — pídele al admin que la agregue".

Admin de navieras (`AdminNavieras`/módulo configuración) gana un campo para editar el template.

## 4. Regla de refresco "Sin Tracking reciente": 7 días o 2 días antes de ETA

En `useDashboardOperador.ts > useSinTrackingOperador`:

- Cambiar `DIAS_TRACKING_ESTANCADO = 3` → `DIAS_TRACKING_ESTANCADO = 7`.
- Cambiar la fuente de `last` de `tracking_externo.last_event_at` a `eventos_embarque` (max `fecha` por embarque), ya que el tracking es manual y `tracking_externo` está vacío.
- Agregar criterio adicional: incluir embarque en el card si **faltan ≤ 2 días para la ETA** y el último evento es anterior a (ETA − 2 días). Es decir: avisar siempre 48h antes del arribo aunque ya se haya actualizado hace poco.
- Ordenar primero por "proximidad a ETA" (≤2d) y luego por días sin update desc.
- En el item del dashboard, mostrar badge "🟠 Próximo a arribar" cuando aplica la regla de 2 días.

## 5. Mejoras adicionales al tab Tracking

a. **Mostrar "Última actualización"** arriba del timeline: "Último evento: hace 4 días — {tipo} en {ubicación}". Si > 7 días, badge ámbar "Requiere actualización".

b. **Atajo "Repetir último evento con nueva fecha"** en cada item del timeline (icono refresh) — preselecciona tipo/ubicación y abre el form con fecha = ahora.

c. **Aviso de ETA vencida**: si `eta < hoy` y el embarque no está Entregado, alert "ETA vencido hace X días — confirma estado real con la naviera" + botón directo a abrir tracking.

d. **Editar/eliminar evento** (sólo autor o admin) — útil cuando el operador captura mal una fecha.

e. **Editar `fecha_llegada_real` desde el tab** sin tener que ir al wizard de edición — campo inline.

f. **Filtro por tipo** en el timeline cuando hay >10 eventos.

g. **Persistir BL en clipboard con feedback visual** (botón cambia a "✓ Copiado" por 2s).

## Sección técnica

### Archivos a tocar
- `supabase/migrations/<timestamp>_naviera_tracking_url.sql` — ALTER navieras + UPDATE con templates iniciales.
- `src/services/catalogos/navieras.ts` — incluir `tracking_url_template` en select/insert/update.
- `src/hooks/catalogos/useNavieras.ts` — exponer el campo (sólo tipos).
- `src/components/embarque/tracking/TrackingNavieraActions.tsx` (nuevo) — tarjeta con botones "Abrir tracking" / "Copiar BL".
- `src/components/embarque/tracking/TrackingUltimaActualizacion.tsx` (nuevo) — banner de freshness + alert ETA vencida.
- `src/components/embarque/tracking/TrackingNuevoEventoForm.tsx` — sugerencia de tipo + post-save prompt (actualizar fecha_llegada_real / avanzar estado).
- `src/components/embarque/tracking/TrackingEventTimeline.tsx` — botón "Repetir evento" + acciones editar/eliminar.
- `src/components/embarque/TabTracking.tsx` — componer los nuevos bloques.
- `src/hooks/dashboard/useDashboardOperador.ts` — nueva fuente `eventos_embarque`, threshold 7d, regla `eta − 2d`, badge "Próximo a arribar".
- `src/components/dashboard/operador/MiOperacionSection.tsx` — mostrar nuevo badge.
- `src/hooks/embarque/useEventosEmbarque.ts` + service `eventos.ts` — mutations `updateEvento` / `deleteEvento`.
- Admin de navieras (página de configuración) — input para `tracking_url_template`.
- `CHANGELOG.md` + bump de `APP_VERSION` (12.51.0 — feature).

### Migración SQL
```sql
ALTER TABLE public.navieras ADD COLUMN tracking_url_template text;
UPDATE public.navieras SET tracking_url_template = '...' WHERE code = 'COSU';
-- (y MAEU, MSCU, HLCU, ONEY, CMDU, EGLV, YMLU, ...)
```

### Lógica freshness (pseudocódigo)
```ts
const necesitaUpdate =
  diasSinUpdate == null ||
  diasSinUpdate >= 7 ||
  (eta && diasHastaEta(eta) <= 2 && ultimoEventoAntesDe(eta - 2d));
```

### Seguridad / RLS
- `tracking_url_template` es público (catálogo). Las policies existentes de `navieras` cubren.
- Edit/delete de eventos: nueva policy `eventos_embarque` → autor o rol admin.

### Pendientes fuera de scope (para próximas iteraciones)
- Recordatorio email/push 48h antes de ETA si el embarque no tiene update reciente.
- Sincronización automática con APIs oficiales de navieras (queda como Opción 2 a futuro, empezando por Maersk gratuito).
