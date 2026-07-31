# Propagar el estado "Por liquidar" a toda la app

Revisé el código y la base de datos buscando todos los lugares que enumeran estados de embarque (`EIR`, `Entregado`, `Cerrado`). El estado nuevo quedó bien en la máquina de estados, el cierre y los timelines, pero **hay lugares que todavía no lo conocen** y eso ya está causando efectos visibles.

## Lo que está roto hoy (verificado)

1. **Botón "Cerrar embarque" bloqueado.** `TabCierre.tsx` sólo acepta `entregado` y `eir` (línea 28). Los 31 embarques que se movieron a *Por liquidar* ya no pueden cerrarse desde la UI, aunque la función de base de datos `cerrar_embarque` sí acepta el estado nuevo. Este es el bug más grave.
2. **Las alertas de "Cierre administrativo" perdieron 31 embarques.** Las funciones de base de datos `embarques_admin_pendientes_count`, `embarques_alertas_ids` y `sidebar_alert_counts` filtran `estado IN ('Entregado','EIR')`. Justo los embarques que más necesitan seguimiento administrativo (los que están en *Por liquidar*) desaparecieron del badge del menú lateral y del panel de alertas.
3. **Dashboard y Operaciones no lo clasifican.** `dashboard_stats`, `dashboard_summary`, `dashboard_details` y `operaciones_stats` agrupan los estados a mano y no incluyen el nuevo, así que estos embarques caen en un limbo (ni activos, ni cerrados) en los conteos, gráficas y listados de Operaciones.
4. **Pruebas desactualizadas (CI rojo).** Fallan `estados-embarque-sync.test.ts` (espera 7 estados en el happy path, ahora son 8) y `useEmbarqueEstadoActions.helpers.test.ts` (espera que después de EIR siga *Cerrado*).
5. **Archivo de esquema desfasado.** `supabase/schema/embarques/avanzar_estado_embarque.sql` no refleja la versión que ya vive en la base de datos (drift), y `supabase/schema/operaciones/operaciones_stats.sql` tampoco.

## Lo que se va a hacer

### 1. Cierre desde la UI
- `TabCierre.tsx`: aceptar también `por liquidar` como estado listo para cierre, y ajustar los textos de ayuda para que expliquen la secuencia real (*EIR → Por liquidar → Cerrado*) en lugar de decir sólo "debe estar en EIR".
- Revisar `useEmbarqueEstadoActions` y `EmbarqueDetalleHeaderActions` para que el botón de avanzar estado muestre la etiqueta correcta y no ofrezca saltos inválidos.

### 2. Alertas administrativas (base de datos)
- Migración que actualice `embarques_admin_pendientes_count`, `embarques_alertas_ids` y `sidebar_alert_counts` para incluir `'Por liquidar'` junto a `'Entregado'` y `'EIR'`. Conceptualmente es *el* estado de pendiente administrativo, así que debe contar siempre.
- Actualizar los textos de la UI que describen la alerta (`EmbarquesAlertasPanel.tsx`, comentario en `useSidebarAlerts.ts`) para mencionar el estado nuevo.

### 3. Dashboard y Operaciones (base de datos)
- Migración que actualice `dashboard_stats`, `dashboard_summary`, `dashboard_details` y `operaciones_stats`:
  - `Por liquidar` se agrupa con los estados post-arribo, no con los activos en tránsito.
  - En el resumen por etapa de Operaciones se muestra como parte del bloque de cierre/administrativo, no como "En Proceso".
- Ajustar `useDashboardController.ts` y `useDashboardData.ts` para contarlo igual que `EIR` en el chip/scope correspondiente.

### 4. Detalles menores de propagación
- `useAdminPendienteResumen.ts`: incluir el estado nuevo en su alcance (hoy documenta y asume sólo Entregado/EIR).
- `src/features/embarques/domain/embarque.ts`: agregar la etiqueta/mapeo de evento de tracking para el estado nuevo (hoy sólo hay `Entregado`, `EIR`, `Cerrado`).

### 5. Pruebas y sincronía de esquema
- Actualizar `estados-embarque-sync.test.ts` y `useEmbarqueEstadoActions.helpers.test.ts` al orden nuevo.
- Agregar caso a `TabCierre.rules.test.ts`: un embarque en *Por liquidar* habilita el botón de cierre.
- Agregar caso en las pruebas del dashboard para el conteo del estado nuevo.
- Regenerar los archivos de `supabase/schema/` afectados para que no haya drift con la base de datos (lo revisa el CI).

### 6. Cierre
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Notas técnicas

- Todas las funciones tocadas son `SECURITY DEFINER` con `search_path` fijo; se recrean con `CREATE OR REPLACE` conservando firma, permisos y filtros de organización actuales (`current_user_org_id()` / `has_role`).
- No se cambia el enum ni la máquina de transiciones: eso ya quedó correcto. Este trabajo es sólo propagación de las listas de estados que quedaron incompletas.
- No se toca la lógica de montos ni de saldos; los criterios de "pendiente administrativo" se conservan idénticos, sólo se amplía el filtro de estado.
