# Cerrar el hueco: embarques en Borrador con factura de cliente

## Qué pasó con ELIMP00310

El embarque sí llegó a estar confirmado (por eso tiene expediente y una factura de cliente F1004 por 4,984 USD, generada desde proforma el 21/07). Después alguien lo regresó a Borrador para editarlo, y el sistema lo permitió sin revisar que ya tenía factura viva.

Es como poder devolver un pedido a "en captura" cuando ya se le entregó la factura al cliente: el papel existe, pero el expediente vuelve a estado de ensayo.

Hoy hay exactamente 2 embarques en esa situación: ELIMP00310 y otro sin expediente.

## Qué se va a hacer

1. **Bloquear el regreso a Borrador** cuando el embarque tenga factura de cliente viva (Borrador, Emitida, Vencida, Parcialmente pagada o Pagada) o proforma viva. Mensaje claro: hay que cancelar o sustituir esos documentos antes de regresar el embarque a Borrador.
2. **Mismo mensaje en la pantalla del embarque**, para que el usuario entienda el motivo en vez de ver un error técnico.
3. **Corregir los 2 casos actuales**: pasarlos a Confirmado dejando registro en la bitácora, sin tocar sus facturas ni sus importes.

## Detalles técnicos

- Migración sobre `public.avanzar_estado_embarque`: nuevo guard cuando `p_nuevo_estado = 'Borrador'`, que rechaza con `LC_BORRADOR_CON_CXC` si existe `facturas` viva (vía `embarque_id` o `factura_embarques.activa`) con `estado <> 'Cancelada'` y `deleted_at IS NULL`, o `proformas` viva (`estado_proforma NOT IN ('cancelada','facturada')`). El guard se coloca antes de `assert_transicion_embarque`; el resto del cuerpo queda intacto. Se reafirma H6 al final (REVOKE ALL FROM PUBLIC/anon; GRANT EXECUTE a authenticated, service_role, postgres).
- Espejo canónico `supabase/schema/embarques/avanzar_estado_embarque.sql` actualizado 1:1 en el mismo cambio.
- Mensaje amigable para `LC_BORRADOR_CON_CXC` en el registro canónico de códigos (`src/lib/errors/`), reutilizado por `useEmbarqueEstadoActions.helpers.ts`.
- Cobertura SQL nueva `supabase/tests/borrador_con_factura_viva.sql`, registrada en `_guards_manifest.txt`: (1) embarque Confirmado con factura viva → `LC_BORRADOR_CON_CXC`; (2) embarque Confirmado sin documentos → regresa a Borrador normalmente; (3) con la factura cancelada, el regreso vuelve a permitirse.
- Prueba focalizada del mapeo de error en el hook de estado.
- Corrección de datos con `run_sql` (no migración): `UPDATE embarques SET estado='Confirmado'` para los 2 ids afectados más su renglón en `bitacora_actividad` explicando el ajuste.
- Versionado: bump de `APP_VERSION`, entrada en `CHANGELOG.md` y `bun run db:release-manifest:update`.
- Validaciones locales focalizadas: typecheck, lint, pruebas de embarques y `db:postcheck`. CI/RLS completos quedan a GitHub Actions.
