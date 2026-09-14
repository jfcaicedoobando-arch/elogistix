# Permitir eliminar un borrador creado por error desde una cotización

## Qué pasa hoy

Cuando eliminas un embarque en borrador que nació de una cotización, el sistema
regresa la cotización a "Aceptada" (para que puedas volver a usarla). Ese regreso
automático choca con una regla de separación de responsabilidades: "quien creó la
cotización no puede aceptarla". Como tú misma creaste la cotización, el sistema
interpreta el regreso como si estuvieras aceptando tu propia cotización y
cancela el borrado con el aviso `LC_SOD_VIOLATION`.

Es como si al cancelar un pedido el sistema te acusara de firmar tu propia
autorización, cuando en realidad sólo está deshaciendo un paso.

## Qué se va a corregir

- La regla de separación seguirá bloqueando lo que debe bloquear: que la persona
  que elaboró la cotización la acepte ella misma cuando la cotización todavía
  está en borrador, solicitada, enviada o vencida.
- Ya no se activará cuando el sistema sólo está deshaciendo una conversión
  (cotización en operación que vuelve a "Aceptada" porque su embarque se
  eliminó).
- Resultado: podrás eliminar el borrador creado por error y la cotización queda
  otra vez disponible como "Aceptada", sin pasos manuales ni pedir apoyo a un
  administrador.

## Detalle técnico

1. Migración sobre `public._cotizaciones_bloquear_auto_aceptacion()`: acotar el
   guard a `OLD.estado IN ('Borrador','Solicitada','Enviada','Vencida')`,
   conservando el resto de la condición (mismo `created_by`, exención de
   admin/admin_org/super_admin, `ERRCODE = check_violation`). No se toca
   `aceptar_cotizacion_version`, que mantiene su propio SoD para la aceptación
   real.
2. Sincronizar el espejo canónico en `supabase/schema/` (baseline se regenera con
   `db:postcheck`) y reafirmar privilegios H6 al final de la migración.
3. Nueva prueba `supabase/tests/eliminar_borrador_cotizacion_sod.sql`, registrada
   en `_guards_manifest.txt`:
   - el creador de la cotización (rol no admin) elimina su embarque borrador y la
     cotización vuelve a "Aceptada";
   - el creador de la cotización sigue recibiendo `LC_SOD_VIOLATION` si intenta
     pasarla de "Enviada" a "Aceptada".
4. Bump de `APP_VERSION` + entrada en `CHANGELOG.md` + `db:release-manifest:update`.
5. Validaciones locales: typecheck y lint focalizados, `audit:manifest` y
   `db:postcheck` en verde. CI/RLS/E2E completos quedan a GitHub Actions.

## Sobre tu borrador actual

Tras aplicar el cambio, tú misma podrás eliminarlo desde el menú de tres puntos.
No se corregirán datos a mano.
