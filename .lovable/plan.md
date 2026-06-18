## Diagnóstico

El permiso `canCrearEmbarqueLibre` ya existe (v13.39.0). La lista `CREAR_EMBARQUE_LIBRE` autoriza únicamente a `super_admin`, `admin_org`, `admin` y `gerente_operaciones`. Para Valeria (`coordinador_logistico`), `requiereCotizacion = true` en `validateWizardStep(1)` y el wizard inyecta el error `"Tu rol requiere iniciar el embarque desde una cotización Aceptada."`.

**Sin embargo**, los embarques `ELIMP00274` y `ELIMP00275` se crearon hoy con `cotizacion_id = NULL`. Posibles causas:

- El enforcement vive **sólo en cliente**. Un INSERT directo vía PostgREST/SDK lo evade — no hay validación a nivel DB.
- El validador puede haberse bypassado si el usuario ya está en step 2-4 cuando el id del cliente cambia y `requiereCotizacion` no se re-evalúa.
- `handleFinish` itera steps 1–4, pero los errores acumulados de step 1 se sobrescriben si el `clienteId` cambia entre pasos.

## Cambios

### 1. Defensa servidor — Trigger BEFORE INSERT en `embarques`
Nueva función `public.enforce_cotizacion_obligatoria()` que rechaza el insert cuando:
- `NEW.cotizacion_id IS NULL`, y
- el `created_by` NO tiene rol en `{super_admin, admin_org, admin, gerente_operaciones}` (consulta `user_roles` + `organization_members`).

Mensaje claro: `'Tu rol requiere vincular una cotización Aceptada para crear el embarque.'`

Esta es la barrera dura — independientemente de la UI, ningún cliente podrá saltársela.

### 2. Reforzar cliente
- En `useNuevoEmbarqueWizard.handleFinish`, agregar comprobación final adicional con `requiereCotizacion && !cotizacionVinculadaId` antes de delegar al orchestrator, mostrando toast destructivo (defense in depth contra el bypass detectado).
- En `BloqueVinculacion`, cuando `requiereCotizacion` es `true`, cambiar el label de `"¿Vincular a cotización existente? (opcional)"` a `"Vincular cotización Aceptada (obligatorio)"` y resaltar la lista.

### 3. Detalle de embarque — badge "Sin cotización"
En la cabecera de embarques que tengan `cotizacion_id = NULL`, mostrar un badge ámbar `Sin cotización` para que el equipo pueda identificar visualmente los casos heredados (149 actuales).

### 4. Bitácora del intento bloqueado
Cuando el trigger rechaza, capturar el error en `useEmbarqueSubmitOrchestrator` y registrar `bitacora_actividad` con `accion='embarque_bloqueado_sin_cotizacion'`, módulo `embarques`. Sirve para auditoría.

### 5. Changelog + `APP_VERSION` 13.66.19

## Fuera de alcance

- No se modifica la lista de roles autorizados (queda `super_admin`, `admin_org`, `admin`, `gerente_operaciones`, según política previa = "admin/dirección").
- No se hace backfill de los 7+ embarques históricos de Valeria sin cotización — se dejan como están y se identifican con el badge.
- No se toca el wizard de edición ni el flujo de Cotización → Embarque (ese siempre llega con `cotizacion_id`).

## Verificación

1. Migration aplicada → comprobar con `psql -c "INSERT INTO embarques ... (sin cotizacion_id) ..."` simulando rol coordinador. Debe fallar.
2. Probar el wizard con cuenta de Valeria (Playwright) y confirmar que toast + alert bloquean el submit.
3. Probar con cuenta admin: debe permitir crear sin cotización.
