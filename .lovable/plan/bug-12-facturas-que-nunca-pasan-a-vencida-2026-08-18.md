# BUG-12 · Facturas que nunca pasan a "Vencida"

## Lo que encontré (verificado en la base real)

Tu diagnóstico de "nada corre por calendario" era la hipótesis natural, pero la realidad es otra y es más sencilla de arreglar:

- La función `public.marcar_facturas_vencidas()` **ya existe** y el cron diario **ya está agendado y activo** (`marcar_facturas_vencidas_diario`, `0 6 * * *`).
- Los últimos 5 días el cron corrió con estado `succeeded`… y marcó **cero facturas**.
- La razón: la versión desplegada de la función trae un filtro de multi-tenant al final del `UPDATE`:

  `AND (es_service_role OR has_role(uid,'super_admin') OR organization_id = current_user_org_id())`

  Corriendo dentro de pg_cron **no hay sesión de usuario**: `auth.role()` es nulo, `auth.uid()` es nulo y `current_user_org_id()` devuelve nulo. Las tres condiciones son falsas, así que el `UPDATE` no toca ninguna fila y el job "termina bien" sin hacer nada.

Analogía: es como un velador con llave que hace su ronda cada noche puntualmente, pero le pusieron una regla de "solo puedes abrir puertas de tu propia oficina"… y el velador no tiene oficina asignada, así que pasa de largo por todas.

Hoy en producción hay **1 factura** en `Emitida` con vencimiento pasado (venció el 02/08) y 2 ya en `Vencida`. El salto en los reportes al desplegar será mínimo, no dramático.

Dos defectos secundarios reales en la misma función:

1. Usa `CURRENT_DATE`, que en este servidor es fecha **UTC**. Entre 18:00 y 24:00 hora de México la fecha ya avanzó un día — el mismo tipo de desfase que se corrigió en EC-06.
2. Incluye `Parcialmente pagada` en el barrido. Al marcarla `Vencida` se pierde la señal de "ya pagó algo", y en el siguiente pago `recalcular_estado_factura` la regresa a `Parcialmente pagada`: el estado queda oscilando.

Buena noticia sobre el alcance: los reportes de cartera y antigüedad **ya filtran por `fecha_vencimiento`** y aceptan `('Emitida','Vencida','Parcialmente pagada')` como saldo vivo, así que los montos de cartera vencida no cambian con este fix — sólo dejan de mentir las **bandejas y badges que filtran por `estado = 'Vencida'`**.

## Qué voy a hacer

Confirmo tu recomendación: **cron + columna almacenada**, no estado derivado en lectura. Y ya que la infraestructura existe, el trabajo es corregirla, no construirla.

1. **Reescribir `marcar_facturas_vencidas()`** en una migración nueva:
   - Quitar el filtro por tenant del barrido programado (es una tarea de plataforma, `SECURITY DEFINER`, no una consulta de usuario).
   - Sólo `Emitida` → `Vencida` (dejar `Parcialmente pagada` en paz).
   - Comparar contra la fecha de negocio en México: `(now() AT TIME ZONE 'America/Mexico_City')::date`.
   - Mantener `deleted_at IS NULL` y el bypass del guard `app.recalc_estado_factura`.
   - Idempotente: correrla dos veces o tarde no cambia el resultado.
2. **Blindar el acceso**: `REVOKE ALL ... FROM PUBLIC, anon, authenticated` y `GRANT EXECUTE` sólo a `service_role` (exige el auditor H6/FIX-45).
3. **Dejar rastro**: registrar cuántas facturas marcó cada corrida en `app_logs` para poder monitorearlo sin adivinar.
4. **Re-agendar el cron a las 06:05 UTC** manteniendo idempotencia (unschedule + schedule por nombre).
5. **Backfill**: ejecutar la función una vez en la misma migración, dejando la cartera al día (hoy: 1 factura).
6. **Prueba SQL de regresión** en `supabase/tests/`: crear factura vencida en `Emitida`, correr la función sin contexto de auth (como lo hace pg_cron) y verificar que queda `Vencida`; verificar que una `Parcialmente pagada` y una `Pagada` no se tocan.

## Detalles técnicos

- `recalcular_estado_factura` ya trata `Vencida` como estado vivo: sólo se salta `Cancelada/Borrador/Sustituida`, y recalcula a `Pagada`/`Parcialmente pagada` cuando llega un pago o una NC. No requiere cambios, lo cubro con la prueba de regresión.
- El guard `guard_estado_factura` permite fijar `Vencida` sólo con el flag `app.recalc_estado_factura='1'` y `current_user = 'postgres'`; bajo pg_cron ambas se cumplen, así que el barrido pasa el guard.
- Sin cambios de frontend. Las bandejas y badges que filtran `estado='Vencida'` empiezan a poblarse solos.
- Cierre estándar: sincronizar el manifiesto de migraciones, `CHANGELOG.md` y bump de `APP_VERSION`.

## Lo que no voy a hacer

- No derivar el estado en lectura (dos fuentes de verdad, rompe los guards de la máquina de estados).
- No tocar los reportes de cartera/antigüedad: ya usan `fecha_vencimiento` y no dependen del estado.
