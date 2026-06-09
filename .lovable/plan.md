
## Objetivo
1. El campo **`operador`** de un embarque debe quedar fijo como el **creador original** y no sobrescribirse en ediciones posteriores.
2. La pestaña **Notas y actividad** debe mostrar de forma robusta el **usuario** que realizó cada cambio (notas manuales, eventos automáticos y entradas de bitácora).

---

## Parte 1 · Operador inmutable = creador

### Causa raíz
En `useEmbarqueSubmitOrchestrator` y `useEditarEmbarqueWizard` se pasa `user?.email` al `buildEmbarquePayload`, que escribe ese valor en `embarques.operador` en **cada** edición. Por eso ELIMP00210 quedó con Juan Luis (último editor) en vez de Valeria (creadora).

Además, `embarques.created_by_email` está vacío para registros históricos (sólo se está poblando bien en altas recientes).

### Cambios de datos (migración + backfill)
- **Migración**: agregar trigger `BEFORE UPDATE ON embarques` que **bloquee la sobrescritura** de `operador` y `created_by_email` una vez establecidos (si el valor anterior no es null/'', el nuevo se ignora).
- **Backfill** (vía insert tool, no migración):
  - Para embarques con `created_by_email` vacío, copiar el `usuario_email` de la primera entrada de `bitacora_actividad` con `accion='crear'` y `modulo='embarques'` para ese embarque.
  - Reasignar `embarques.operador` al `created_by_email` resultante en todos los embarques (sobrescribe el comportamiento previo y deja la regla consistente con la nueva).

### Cambios de código
- `src/features/embarques/hooks/useEditarEmbarqueWizard.ts`: dejar de pasar `user?.email` como operador en el payload de edición. Pasar el `operador` actual del embarque (o simplemente omitirlo del payload de update).
- `src/features/embarques/hooks/useEmbarqueSubmitOrchestrator.ts`: en flujo de **creación** seguir asignando `user?.email` a `operador` (ahí sí es el creador). En flujo de **edición** no incluir `operador` en el update.
- `src/features/embarques/services/mutations.ts` (`updateEmbarque`): hacer strip defensivo de `operador` y `created_by_email` del objeto a actualizar, como red de seguridad.
- UI del detalle: renombrar la etiqueta del campo en pantalla de "Operador" → "**Creador / Responsable**" para reflejar la semántica nueva (el campo "operador asignado" deja de ser editable desde el wizard de edición).

---

## Parte 2 · Pestaña Notas y Actividad robusta

### Estado actual
- `notas_embarque.usuario` existe pero llega vacío en notas del sistema (caso ELIMP00210: el "Embarque creado" no tiene autor).
- Los cambios de estado generan un evento en `eventos_embarque` con `usuario='sistema'` en vez del usuario real.
- La pestaña hoy muestra `notas_embarque` y `eventos_embarque` por separado; no combina la `bitacora_actividad` filtrada por `entidad_id = embarque.id`.

### Cambios de datos
- Migración: al insertar nota de sistema o evento de cambio de estado desde el flujo de update, registrar el `auth.email()` (o `auth.uid()` resuelto) como `usuario` en lugar de la cadena literal `'sistema'`. Aplica a:
  - Trigger/función que crea la nota "Embarque creado".
  - Trigger/función que crea el evento `Zarpe` / `Arribo` al cambiar `estado`.
- Backfill: para notas y eventos existentes con `usuario` vacío o `'sistema'`, intentar resolver el autor cruzando con `bitacora_actividad` por `entidad_id` + ventana de tiempo cercana al `created_at`.

### Cambios de UI (pestaña Notas/Actividad)
- Crear un hook `useEmbarqueActividadFeed(embarqueId)` que combine en un solo arreglo ordenado por fecha desc:
  1. `notas_embarque` (tipo `nota` y `cambio_estado`)
  2. `eventos_embarque` (tracking automático)
  3. `bitacora_actividad` (`entidad_id = embarqueId` AND `modulo IN ('embarques','documentos_embarque','facturas')`)
- Cada item del feed expone: `fecha`, `tipo` (nota / evento / bitácora), `accion`, `usuario_email`, `descripcion`, `detalles` (diff de campos cuando aplique).
- Componente `ActividadEmbarqueTimeline.tsx` (≤200 líneas): timeline con avatar/iniciales del usuario, badge por tipo, descripción, y un acordeón opcional con el `detalles` JSON cuando es una edición (mostrando campos modificados).
- Para notas manuales: el formulario ya inserta nota; asegurar que `usuario` se llene con `user?.email` desde el cliente (defensa en profundidad además del trigger).
- Mostrar "Sistema" sólo cuando realmente no hay autor humano resoluble.

### Bitácora más rica en edición
- En `updateEmbarque`, además de la entrada actual `accion='editar'`, calcular el **diff** de campos editados (modo, tipo, cliente, etd, eta, estado, etc.) y guardarlo en `detalles.cambios = [{ campo, antes, despues }]` para que el timeline pueda mostrar "Juan Luis cambió ETD de 20/05 → 23/05".

---

## Detalles técnicos

**Archivos a tocar (código)**
- `src/features/embarques/hooks/useEditarEmbarqueWizard.ts`
- `src/features/embarques/hooks/useEmbarqueSubmitOrchestrator.ts`
- `src/features/embarques/services/mutations.ts`
- `src/features/embarques/hooks/useEmbarqueActividadFeed.ts` (nuevo)
- `src/features/embarques/components/notas/ActividadEmbarqueTimeline.tsx` (nuevo, reemplaza el render actual de la pestaña)
- Componente de detalle del embarque: cambiar etiqueta "Operador" → "Creador / Responsable" y quitar input editable.

**Migraciones**
- Trigger `embarques_protect_creator` (BEFORE UPDATE) que preserva `operador` y `created_by_email` si ya estaban definidos.
- Ajuste de funciones/triggers que generan notas de sistema y eventos automáticos para registrar `auth.jwt()->>'email'` como `usuario`.

**Backfill (insert tool, no migración)**
- UPDATE de `embarques.created_by_email` desde `bitacora_actividad`.
- UPDATE de `embarques.operador = created_by_email`.
- UPDATE de `notas_embarque.usuario` y `eventos_embarque.usuario` cuando estén vacíos o `'sistema'`, resolviendo por bitácora.

**Versionado**
- Bump `APP_VERSION` y entrada en `CHANGELOG.md` describiendo: (1) operador queda fijo = creador, (2) timeline unificado con autor real, (3) bitácora con diff de campos.

---

## Fuera de alcance
- Reescribir el sistema de roles o permisos (eso ya se atendió en 12.68.x).
- Cambiar la lógica de generación de eventos de tracking más allá de poblar el `usuario`.
- Editor visual de diffs avanzado; basta con lista de campos cambiados.
