
# Editor de tarifas en el Portal del Agente

Hoy `/agente/tarifas` es sólo lectura. Vamos a habilitar que el agente cree y mantenga sus tarifas, sus recargos, su carta garantía y su tabulador de demoras — siempre dejando el estado en **borrador** para que operaciones apruebe.

## Qué verá el agente

En `/agente/tarifas` aparecerá un botón **"Nueva tarifa"** arriba a la derecha y, en cada fila, un menú con **Editar** (sólo si la tarifa está en *borrador* o *rechazada*) y **Duplicar** (para revisar una vigente sin tocarla).

El modal de captura reutiliza el formulario de operaciones (`TarifaForm` + `TarifaRecargosEditor`), pero adaptado:

- El campo "Agente" queda **fijo y bloqueado** al agente logueado (no puede capturar tarifas a nombre de otro).
- El estado de aprobación se fija siempre a **borrador**; el agente nunca lo elige.
- Al guardar, aparece un aviso: *"Tu tarifa quedó en borrador. Operaciones la revisará y te avisará cuando esté vigente."*

En `/agente/garantias` (hoy placeholder) se habilita:

- Subida de la **carta garantía** (PDF) al bucket privado `agente-cartas-garantia` bajo la carpeta `{agente_id}/`.
- Captura del **tabulador escalonado de demoras** (rangos de días + tarifa USD por contenedor) usando la tabla `costeo_naviera_demoras_tarifa` ya existente.
- Vínculo con la naviera y vigencia, igual que en el módulo de operaciones.

## Reglas de edición (importante)

| Estado actual | ¿Puede editar? | ¿Puede borrar? |
|---|---|---|
| Borrador | Sí | Sí |
| Rechazada | Sí (al guardar vuelve a borrador) | Sí |
| Vigente | **No** — sólo puede **Duplicar** para crear una nueva versión | No |
| Reemplazada | No | No |

Esto cumple lo que pediste: una tarifa ya aprobada queda congelada. Para cambiarla, se duplica y la nueva versión entra como borrador para re-aprobación.

## Detalles técnicos

**Frontend** (`src/features/portal-agente/`):

- `routes/AgenteTarifas.tsx`: agregar botón "Nueva tarifa", menú de acciones por fila, y montar el modal.
- `components/AgenteTarifaForm.tsx` (nuevo): wrapper sobre `TarifaForm` que:
  - Inyecta `agente_id` desde `useAgenteContext()` y lo pasa como prop bloqueada.
  - Fuerza `estado_aprobacion: 'borrador'` en el payload.
  - Usa hooks propios del portal (no los de operaciones) para no exponer mutations cross-org.
- `components/AgenteTarifaForm.tsx` necesita una pequeña modificación a `TarifaForm` para aceptar `agenteIdFijo?: string` que oculte/deshabilite el `Select` de agente. Cambio retro-compatible.
- `hooks/index.ts`: añadir `useAgenteTarifaMutations()` (crear/actualizar/eliminar) que llaman a un service nuevo.
- `services/index.ts`: añadir `insertAgenteTarifa`, `updateAgenteTarifa`, `deleteAgenteTarifa`, `duplicateAgenteTarifa`. Reutilizan la lógica de `services/tarifas.ts` pero forzando `agente_id = current_agente_id()` y `estado_aprobacion='borrador'`.
- `routes/AgenteGarantias.tsx`: reemplazar placeholder por:
  - Listado de garantías vigentes del agente (`costeo_navieras_condiciones`).
  - Form `AgenteGarantiaForm.tsx` con upload del PDF + sub-editor de tramos de demoras.

**Backend / RLS**:

- Las policies actuales ya permiten al rol `agente_carga` `INSERT/UPDATE/DELETE` en `costeo_tarifas`, `costeo_tarifa_recargos`, `costeo_navieras_condiciones`, `costeo_naviera_demoras_tarifa` siempre que `agente_id = current_agente_id()`.
- **Falta endurecer** dos cosas vía migración:
  1. Trigger `costeo_tarifas_agente_borrador_check`: si el caller tiene rol `agente_carga`, forzar `estado_aprobacion='borrador'` en INSERT y bloquear UPDATE cuando el estado actual sea `vigente` o `reemplazada`.
  2. Policy de `storage.objects` en bucket `agente-cartas-garantia`: confirmar que la carpeta raíz coincide con `current_agente_id()::text` para INSERT/UPDATE/DELETE/SELECT.

**Sin cambios** en operaciones: el RPC `agente_aprobar_tarifa` y el flujo de aprobación ya existen y siguen igual.

## Versionado y memoria

- Bump `APP_VERSION` → `13.129.0` (feature nuevo).
- Entrada en `CHANGELOG.md`.
- Actualizar `mem://features/portal-agente-carga` quitando del bloque "Pendiente" lo que se entrega.

## Lo que NO entra en esta iteración

- Notificación interna automática al subir tarifa (queda como TODO en la memoria).
- UI inline de aprobar/rechazar en `/costeo/tarifas` para operaciones (ya existe el RPC, falta el botón — siguiente sprint).
