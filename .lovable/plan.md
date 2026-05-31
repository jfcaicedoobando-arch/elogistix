# Plan: documentar el proceso oficial de aceptación de cotización

## Objetivo

Crear **`docs/flujo-aceptacion-cotizacion.md`** que describa, en español de México, el proceso end-to-end cuando un cliente acepta una cotización desde el portal. El documento sirve como referencia para operaciones, soporte y futuros desarrolladores. **No se modifica código ni schema**.

## Entregable

Un único archivo nuevo: `docs/flujo-aceptacion-cotizacion.md`.

## Estructura del documento

1. **Resumen ejecutivo** — diagrama lineal en bloque `text` del happy path:

   ```text
   Borrador → Enviada → (cliente acepta en portal) → Aceptada
       → (operaciones crea + vincula embarque) → En operación
   ```

2. **Actores y responsabilidades**
   - Cliente (portal): acepta / rechaza / comenta.
   - Operaciones (app interna): da seguimiento, crea embarque, lo vincula.
   - Sistema: valida, cambia estados, cierra oportunidades CRM.

3. **Estados de la cotización (`estado_cotizacion`)** — tabla con los 7 valores, descripción, quién los dispara, y transiciones válidas. Marcar `Confirmada` como **legado / sin uso**.

4. **Paso a paso del flujo actual** — qué hace cada capa cuando el cliente pulsa "Aceptar":
   - UI portal (`PortalCotizacionDetalle` + diálogo de confirmación con comentario).
   - RPC `portal_responder_cotizacion` (validaciones de tenencia y de estado, columnas que actualiza: `estado`, `comentario_cliente`, `updated_at`).
   - Trigger `crm_cierra_oportunidad_desde_cotizacion` cuando hay `oportunidad_id`.
   - Acción manual de operaciones: crear embarque y vincular `embarques.cotizacion_id`.
   - Trigger `sync_cotizacion_embarque_link` que pasa la cotización a `En operación`.

5. **Flujo de rechazo y vencimiento** — sección breve para completar el cuadro.

6. **Reglas de negocio**
   - Solo el cliente dueño puede aceptar (RLS / `current_user_client_ids`).
   - Solo cotizaciones en `Enviada` son aceptables; en cualquier otro estado el portal oculta el botón y la RPC rechaza.
   - El comentario del cliente es opcional, se almacena tal cual sin saneamiento HTML (es texto plano).
   - La aceptación **no** crea embarque ni factura automáticamente.

7. **Notificaciones**
   - **Estado actual**: el diálogo del portal indica que "el equipo será notificado", pero **no hay código** que envíe email ni notificación in-app a operaciones.
   - **Recomendación a futuro** (no implementar ahora): notificación dual al rol `operador`/`admin` de la organización dueña — campana in-app + email transaccional vía la infraestructura de Lovable Emails.

8. **Brechas conocidas**
   - No existe `cotizaciones.fecha_aceptacion`; solo `updated_at` (se sobreescribe en cualquier edición).
   - No hay bitácora dedicada para cambios de estado de cotización.
   - No hay notificación al staff al momento de la aceptación.
   - Estado `Confirmada` huérfano en el enum.

9. **Apéndice — referencias de código**
   - `src/pages/portal/PortalCotizacionDetalle.tsx`
   - `src/components/portal/cotizacion/PortalCotizacionHeader.tsx`
   - `src/hooks/portal/usePortalCotizacionDetalleController.ts`
   - `src/hooks/portal/usePortalCotizacionMutations.ts`
   - `src/services/cotizacion/conversiones/portal.ts`
   - Migraciones relevantes: enum (`20260302165947`, `20260302171122`, `20260427015721`), RPC (`20260410005236`), trigger CRM (`20260525232901`), trigger vínculo embarque (`20260427025307`).

## Pasos de implementación (solo edición de docs)

1. Crear `docs/flujo-aceptacion-cotizacion.md` con la estructura de arriba.
2. Actualizar `CHANGELOG.md` (root) con entrada `docs(cotizaciones)` y bump de `APP_VERSION` a **12.25.3** (regla del proyecto: cualquier cambio versionable, incluida documentación, registra changelog + versión).

## Fuera de alcance

- Ningún cambio en `src/`, migraciones, edge functions, RLS, ni en el enum.
- No se implementa notificación a staff, columna `fecha_aceptacion`, bitácora, ni creación automática de embarque borrador. Quedan listadas como brechas en el propio documento para una futura iteración.
