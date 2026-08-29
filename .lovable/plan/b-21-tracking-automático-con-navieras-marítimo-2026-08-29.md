# B-21 · Tracking automático con navieras (marítimo)

Hoy el tracking es 100% manual: el operador abre la web de la naviera, copia el último evento y lo captura a mano (`TrackingNavieraActions`). La base ya tiene el andamiaje reservado (`tracking_externo`, `tracking_intentos`, `tracking_webhook_log`, con `provider = 'terminal49'`) pero ningún proceso lo escribe.

## Qué se va a construir

Un puente entre la naviera y el expediente, listo para encender cuando exista la cuenta del proveedor:

1. **Suscripción por embarque.** En el tab Tracking de un embarque marítimo aparece "Activar tracking automático". Toma el BL Master (o booking / número de contenedor) y el SCAC de la naviera, y registra la suscripción con el proveedor. Muestra estado: pendiente, activo, o fallido con el motivo en español ("la naviera no reconoce ese BL todavía").
2. **Recepción de eventos.** Cada aviso del proveedor entra por un webhook, se guarda crudo (para auditar), se deduplica y se traduce a un evento del timeline del embarque usando los tipos que ya existen (Zarpe, Transbordo, Arribo a Puerto, Descarga, Cambio de ETA, …).
3. **Actualización de ETA.** Cuando la naviera mueve la fecha estimada de arribo, se actualiza el ETA del embarque y queda registrado en la bitácora quién/qué lo cambió ("Tracking automático · naviera"). **No** se avanza el estado del embarque: eso sigue siendo decisión del operador.
4. **Respaldo nocturno.** Un proceso diario recorre los embarques marítimos activos con suscripción y reconsulta al proveedor, por si un webhook se perdió. Con candado de concurrencia (como los procesos nocturnos ya existentes).
5. **Bandera de encendido.** Sin API key cargada, todo el módulo queda visible pero inactivo con el aviso "Falta configurar la conexión con el proveedor de tracking". Nada se rompe ni truena en producción.
6. **Panel de diagnóstico.** En el tab Tracking, un historial de intentos (fecha, resultado, mensaje) para que el operador entienda por qué no llegan eventos, sin pedir soporte.

## Alcance acordado

- Sólo marítimo (FCL/LCL). Aéreo y terrestre siguen manuales.
- El sistema registra eventos y ETA; **no** avanza estados.
- Webhook en tiempo real + respaldo diario.
- Proveedor: se implementa contra Terminal49 (el ya presente en la base), detrás de la bandera, porque la cuenta aún no existe.

## Detalles técnicos

**Base de datos (una migración)**

- `tracking_externo`: agregar `webhook_secret_hash` no; en su lugar añadir columnas faltantes si aplica (`ultimo_error_at`), y trigger `updated_at` ya existe. Confirmar policies actuales (staff admin/operador) sirven para lectura desde UI.
- Nueva RPC `tracking_registrar_evento_externo(p_embarque_id, p_provider_event_id, p_tipo, p_descripcion, p_ubicacion, p_fecha, p_eta_nueva)`: `SECURITY DEFINER`, sólo `service_role`. Inserta en `eventos_embarque` de forma idempotente por `provider_event_id`, actualiza `eta` del embarque cuando llega y escribe en `bitacora_actividad`. Respeta soft-delete y embarque cerrado (no escribe).
- Nueva RPC `tracking_embarques_por_sincronizar(p_limite)` para el proceso nocturno (marítimos activos con suscripción `activo`, ordenados por `last_synced_at` más antiguo).
- Guard SQL nuevo en `supabase/tests/` + entrada en `_guards_manifest.txt`, y baseline regenerada (`bun run db:postcheck`).

**Edge functions**

- `tracking-suscribir`: valida JWT + rol staff, valida entrada con Zod (BL/booking/contenedor + SCAC), llama al proveedor, hace upsert en `tracking_externo` y registra el intento en `tracking_intentos`. Devuelve error de negocio legible cuando el proveedor rechaza la referencia.
- `tracking-webhook`: sin JWT, verifica firma del proveedor (secreto compartido), guarda en `tracking_webhook_log` (dedupe por `provider` + `event_id`), mapea el payload a eventos y llama la RPC con `service_role`. Responde 200 siempre que el evento quede persistido, para que el proveedor no reintente en bucle.
- `tracking-sync-nocturno`: cron diario, candado en `cron_locks`, lotes acotados, escribe intentos y `last_synced_at`.
- Mapeo proveedor → dominio en `supabase/functions/_shared/tracking/` (puro y testeable).

**Frontend**

- `src/features/embarques/services/tracking/suscripcion.ts` — llamadas a las edges e `useTrackingSuscripcion` / `useTrackingIntentos` (react-query, keys en `queryKeys.ts`).
- `TrackingSuscripcionCard.tsx` (activar / estado / desactivar) y `TrackingIntentosList.tsx`, integrados en el tab Tracking junto a `TrackingNavieraActions` (que se conserva como camino manual).
- Los eventos automáticos se distinguen en el timeline con `usuario = "Tracking automático"` y un badge.
- Bandera derivada del estado de configuración devuelto por la edge; sin key ⇒ tarjeta en modo informativo.

**Secreto requerido**

- `TERMINAL49_API_KEY` y `TRACKING_WEBHOOK_SECRET`: se piden al aplicar el plan; hasta que existan, el módulo queda inactivo por diseño.

**Cierre**

- Tests unitarios del mapeo de eventos y del hook; guard SQL verde; `db:postcheck` verde con baseline regenerada; `APP_VERSION` + `CHANGELOG.md`; `roadmap.md` marca B-21 como hecho.

No hagas nada. Merjo no lo implementamos.